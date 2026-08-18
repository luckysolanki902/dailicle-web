import clientPromise from "@/lib/mongodb";
import nodemailer from "nodemailer";
import type { Collection, Document } from "mongodb";
import { gaConfigured, sendServerEvent } from "@/lib/ga-server";
import { markJourneySupported } from "@/lib/journey-store";
import { subunitsToMajor } from "@/lib/pricing";
import {
  contactFromPayment,
  fetchOrderPayments,
  fetchPayment,
  paymentAttemptScore,
  razorpayFacts,
} from "@/lib/razorpay";
import { buildPaymentMerge, type MergeInput } from "@/lib/supporter-merge";

/**
 * Persistence + owner-notification for the optional support flow. Every payment
 * is recorded in detail in the `supporters` collection (amount, currency,
 * country, timing, method, contact Razorpay gives us we never ask the reader
 * for a name). The owner is emailed once, when a payment is confirmed captured.
 */

export async function supportersCollection(): Promise<Collection<Document>> {
  const client = await clientPromise;
  const col = client.db("dailicle").collection("supporters");
  // Idempotency: one document per Razorpay order. Payments upsert onto it.
  await col.createIndex({ orderId: 1 }, { unique: true });
  await col.createIndex({ paymentId: 1 }, { sparse: true });
  return col;
}

/**
 * Count successful contributions since a given instant. The payment ledger is
 * the source of truth; `verifiedAt` is preferred, then the webhook capture
 * time, with `createdAt` retained for older records.
 */
export async function countSuccessfulSupportsSince(
  since: Date
): Promise<number> {
  const col = await supportersCollection();
  const rows = await col
    .aggregate<{ count: number }>([
      { $match: { status: { $in: ["paid", "captured"] } } },
      {
        $addFields: {
          _successfulAt: {
            $ifNull: [
              "$verifiedAt",
              { $ifNull: ["$capturedAt", "$createdAt"] },
            ],
          },
        },
      },
      { $match: { _successfulAt: { $gte: since } } },
      { $count: "count" },
    ])
    .toArray();
  return rows[0]?.count ?? 0;
}

/**
 * The single write path for everything Razorpay tells us about a payment.
 *
 * This is a merge, not an overwrite — see `supporter-merge.ts` for the rules and
 * why they matter. Applied as an aggregation-pipeline update so the whole
 * compare-and-merge is atomic inside Mongo: /verify and the webhook routinely
 * land at the same instant, and a read-then-write in Node would lose one.
 */
export async function recordPayment(
  input: MergeInput
): Promise<Document | null> {
  if (!input.orderId) return null;
  const { pipeline } = buildPaymentMerge(input);
  const col = await supportersCollection();
  return await col.findOneAndUpdate({ orderId: input.orderId }, pipeline, {
    upsert: true,
    returnDocument: "after",
  });
}

/**
 * Last-resort recovery of the reader's email/phone.
 *
 * If the record still has neither after the normal paths ran — the payment fetch
 * failed, the webhook hasn't arrived, the tab closed mid-checkout — go ask
 * Razorpay directly. With just the order id we can list every attempt made
 * against it and take the contact details off the furthest-along one. Silent and
 * best-effort: this must never break a payment that already succeeded.
 *
 * Razorpay only. A PayPal payment carries the payer's account email in the
 * capture response itself, so there is nothing to go back for.
 */
export async function backfillContact(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    const col = await supportersCollection();
    const doc = await col.findOne({ orderId });
    if (doc?.provider === "paypal") return;
    if (doc?.email && doc?.contact) return;

    // Prefer the known payment id; fall back to listing the order's attempts.
    let candidates: Record<string, unknown>[] = [];
    if (doc?.paymentId) {
      try {
        candidates = [await fetchPayment(String(doc.paymentId))];
      } catch {
        // Fall through to the order-level lookup.
      }
    }
    if (!candidates.length) {
      candidates = await fetchOrderPayments(orderId);
    }
    if (!candidates.length) return;

    const best = [...candidates].sort(
      (a, b) => paymentAttemptScore(b) - paymentAttemptScore(a)
    )[0];

    // Merge contact details from *any* attempt — a reader who mistyped a card
    // and retried still gave us their email on the failed attempt.
    const merged: Record<string, unknown> = { ...best };
    for (const attempt of candidates) {
      const { email, contact } = contactFromPayment(attempt);
      if (email && !contactFromPayment(merged).email) merged.email = email;
      if (contact && !contactFromPayment(merged).contact) {
        merged.contact = contact;
      }
    }

    await recordPayment({
      orderId,
      paymentId: (best.id as string) || (doc?.paymentId as string) || null,
      facts: razorpayFacts(merged),
      via: "backfill",
    });
  } catch (err) {
    console.error("backfillContact failed:", err);
  }
}

/**
 * Atomically claim the right to send the owner's "new support" email. Only the
 * first caller gets the document back; verify and the webhook both try, and
 * without the atomic claim they can both win a plain read-then-write and the
 * owner gets the same payment twice.
 */
export async function claimNotification(
  orderId: string
): Promise<Document | null> {
  const col = await supportersCollection();
  return await col.findOneAndUpdate(
    { orderId, notified: { $ne: true } },
    { $set: { notified: true } },
    { returnDocument: "after" }
  );
}

/**
 * Record a *verified* payment to GA4 server-side, exactly once per order. This
 * is the authoritative conversion it survives ad-blockers and closed tabs,
 * where the browser's `support_payment_success` event would be lost. Stitched
 * to the reader's GA session by the client id captured at checkout. Guarded by
 * an atomic `gaReported` flag so verify + webhook can both call it safely.
 */
export async function reportPaymentToGa(orderId: string): Promise<void> {
  if (!gaConfigured() || !orderId) return;
  try {
    const col = await supportersCollection();
    // Claim the report: only the first caller flips the flag and proceeds.
    // Driver v7 returns the (updated) document directly, or null if no match.
    const doc = await col.findOneAndUpdate(
      { orderId, gaReported: { $ne: true } },
      { $set: { gaReported: true } },
      { returnDocument: "after" }
    );
    if (!doc) return;

    // The browser gives us a GA client id at checkout, but it's frequently
    // absent — ad-blockers, a closed tab, or gtag simply not having loaded in
    // time. GA4's Measurement Protocol still needs *a* client_id, so fall back
    // to a deterministic per-order id. This means the revenue event always
    // fires (the payment is real); it just isn't stitched to a browser session
    // when the id was missing. Without this, real revenue silently vanished.
    const clientId = doc.gaClientId
      ? String(doc.gaClientId)
      : `srv.${orderId}`;

    const subunits =
      typeof doc.amountCaptured === "number"
        ? doc.amountCaptured
        : typeof doc.amount === "number"
          ? doc.amount
          : 0;

    const currency =
      (doc.currencyCaptured as string) || (doc.currency as string) || "INR";

    await sendServerEvent(clientId, "support_payment_verified", {
      // Not every currency is 1/100 — yen is whole units, the Gulf dinars are
      // 1/1000 — so this must not divide by a hardcoded hundred.
      value: subunitsToMajor(subunits, currency),
      currency,
      source: (doc.source as string) || "unknown",
      tier: (doc.tier as string) || undefined,
      method: (doc.method as string) || undefined,
      country: (doc.country as string) || undefined,
      category: (doc.category as string) || undefined,
      essay_id: (doc.essayId as string) || undefined,
    });
  } catch (err) {
    console.error("reportPaymentToGa failed:", err);
  }
}

/**
 * Stamp the reader's anonymous journey with "this one paid", exactly once per
 * order. The link is the random visitor id their browser minted — never an
 * email or anything else that identifies the person. Guarded by an atomic
 * `journeyLinked` flag so verify and webhook can both call it.
 */
export async function linkPaymentToJourney(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    const col = await supportersCollection();
    const doc = await col.findOneAndUpdate(
      { orderId, journeyLinked: { $ne: true } },
      { $set: { journeyLinked: true } },
      { returnDocument: "after" }
    );
    if (!doc?.vid) return;
    await markJourneySupported(String(doc.vid), new Date());
  } catch (err) {
    console.error("linkPaymentToJourney failed:", err);
  }
}

function money(subunits: unknown, currency: unknown): string {
  const n = typeof subunits === "number" ? subunits / 100 : NaN;
  const cur = typeof currency === "string" ? currency : "";
  return Number.isFinite(n) ? `${cur} ${n.toLocaleString()}` : String(subunits);
}

/**
 * Inform the owner about a captured payment. Fire-and-forget: a mail failure
 * must never break the payment flow. Called once per order (guarded by the
 * caller via the `notified` flag).
 */
export async function notifyOwnerOfPayment(record: {
  orderId: string;
  paymentId?: string;
  amount: number;
  currency: string;
  country?: string | null;
  source?: string | null;
  method?: string | null;
  email?: string | null;
  contact?: string | null;
  message?: string | null;
}): Promise<void> {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const when = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const messageRow = record.message
      ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Message</td><td style="white-space:pre-wrap"><em>${esc(
          record.message
        )}</em></td></tr>`
      : "";

    await transporter.sendMail({
      from: user,
      to: "read@dailicle.com",
      subject: `💛 New support - ${money(record.amount, record.currency)} - The Dailicle`,
      html: `
        <h2>Someone supported The Dailicle</h2>
        <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>${money(record.amount, record.currency)}</strong></td></tr>
          ${messageRow}
          <tr><td style="padding:4px 12px 4px 0;color:#666">Country</td><td>${record.country || "unknown"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Method</td><td>${record.method || "-"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Contact</td><td>${record.email || record.contact || "-"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Where</td><td>${record.source || "-"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Time (IST)</td><td>${when}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Payment id</td><td>${record.paymentId || "-"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Order id</td><td>${record.orderId}</td></tr>
        </table>
      `,
    });
  } catch (err) {
    console.error("Failed to notify owner of payment:", err);
  }
}
