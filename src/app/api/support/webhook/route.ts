import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  supportersCollection,
  notifyOwnerOfPayment,
  reportPaymentToGa,
} from "@/lib/supporters";

export const runtime = "nodejs";

/**
 * Server-to-server source of truth. Razorpay POSTs here on payment events; we
 * verify the signature over the RAW body with the webhook secret, then upsert
 * the payment and notify the owner exactly once. Even if the browser never
 * calls /verify (closed tab, blocked JS), this still records the payment.
 */
export async function POST(request: NextRequest) {
  // Raw body is required for HMAC verification.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: Record<string, unknown> };
      order?: { entity?: Record<string, unknown> };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Bad payload." }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  const eventName = event.event || "";

  // Only act on real payment lifecycle events.
  if (!payment || !["payment.captured", "payment.authorized", "order.paid"].includes(eventName)) {
    return NextResponse.json({ received: true });
  }

  const orderId = String(payment.order_id || "");
  const paymentId = String(payment.id || "");
  if (!orderId) return NextResponse.json({ received: true });

  const captured = eventName === "payment.captured" || eventName === "order.paid";
  const now = new Date();

  try {
    const col = await supportersCollection();
    const existing = await col.findOne({ orderId });

    await col.updateOne(
      { orderId },
      {
        $setOnInsert: { orderId, createdAt: now, notified: false },
        $set: {
          paymentId,
          status: captured ? "captured" : "authorized",
          method: (payment.method as string) || null,
          email: (payment.email as string) || null,
          contact: (payment.contact as string) || null,
          fee: (payment.fee as number) ?? null,
          tax: (payment.tax as number) ?? null,
          amountCaptured: (payment.amount as number) ?? null,
          currencyCaptured: (payment.currency as string) ?? null,
          country: existing?.country ?? null,
          source: existing?.source ?? "webhook",
          amount: existing?.amount ?? (payment.amount as number) ?? null,
          currency: existing?.currency ?? (payment.currency as string) ?? null,
          razorpay: payment,
          capturedAt: captured ? now : existing?.capturedAt ?? null,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    // Notify once, only on a real capture.
    if (captured && !existing?.notified) {
      await col.updateOne({ orderId }, { $set: { notified: true } });
      await notifyOwnerOfPayment({
        orderId,
        paymentId,
        amount: (payment.amount as number) ?? 0,
        currency: (payment.currency as string) ?? "",
        country: (existing?.country as string | null) ?? null,
        source: (existing?.source as string | null) ?? "webhook",
        method: (payment.method as string) || null,
        email: (payment.email as string) || null,
        contact: (payment.contact as string) || null,
      });
    }

    // Backup conversion to GA4 for closed-tab payments (once per order).
    if (captured) await reportPaymentToGa(orderId);
  } catch (error) {
    // Return 500 so Razorpay retries the webhook.
    console.error("support/webhook error:", error);
    return NextResponse.json({ message: "Processing error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
