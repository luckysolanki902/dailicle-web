import clientPromise from "@/lib/mongodb";
import nodemailer from "nodemailer";
import type { Collection, Document } from "mongodb";
import { gaConfigured, sendServerEvent } from "@/lib/ga-server";

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
    if (!doc || !doc.gaClientId) return;

    const subunits =
      typeof doc.amountCaptured === "number"
        ? doc.amountCaptured
        : typeof doc.amount === "number"
          ? doc.amount
          : 0;

    await sendServerEvent(String(doc.gaClientId), "support_payment_verified", {
      value: subunits / 100,
      currency:
        (doc.currencyCaptured as string) || (doc.currency as string) || "INR",
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

    await transporter.sendMail({
      from: user,
      to: "luckysolanki902@gmail.com",
      subject: `💛 New support - ${money(record.amount, record.currency)} - The Dailicle`,
      html: `
        <h2>Someone supported The Dailicle</h2>
        <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>${money(record.amount, record.currency)}</strong></td></tr>
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
