import clientPromise from "@/lib/mongodb";
import nodemailer from "nodemailer";
import type { Collection, Document } from "mongodb";

/**
 * Persistence + owner-notification for the optional support flow. Every payment
 * is recorded in detail in the `supporters` collection (amount, currency,
 * country, timing, method, contact Razorpay gives us — we never ask the reader
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
      subject: `💛 New support — ${money(record.amount, record.currency)} — The Dailicle`,
      html: `
        <h2>Someone supported The Dailicle</h2>
        <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>${money(record.amount, record.currency)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Country</td><td>${record.country || "unknown"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Method</td><td>${record.method || "—"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Contact</td><td>${record.email || record.contact || "—"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Where</td><td>${record.source || "—"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Time (IST)</td><td>${when}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Payment id</td><td>${record.paymentId || "—"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Order id</td><td>${record.orderId}</td></tr>
        </table>
      `,
    });
  } catch (err) {
    console.error("Failed to notify owner of payment:", err);
  }
}
