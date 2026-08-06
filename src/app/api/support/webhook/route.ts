import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, razorpayFacts } from "@/lib/razorpay";
import {
  notifyOwnerOfPayment,
  reportPaymentToGa,
  linkPaymentToJourney,
  recordPayment,
  backfillContact,
  claimNotification,
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

  // Only act on real payment lifecycle events. `payment.failed` is included on
  // purpose: a failed attempt still carries the email/phone the reader typed,
  // and readers who retry successfully often do so via a different method that
  // hands us less. Recording it costs nothing and never overwrites better data.
  const HANDLED = [
    "payment.captured",
    "payment.authorized",
    "order.paid",
    "payment.failed",
  ];
  if (!payment || !HANDLED.includes(eventName)) {
    return NextResponse.json({ received: true });
  }

  const orderId = String(payment.order_id || "");
  const paymentId = String(payment.id || "");
  if (!orderId) return NextResponse.json({ received: true });

  const captured = eventName === "payment.captured" || eventName === "order.paid";
  const status = captured
    ? "captured"
    : eventName === "payment.failed"
      ? "failed"
      : "authorized";

  try {
    const doc = await recordPayment({
      orderId,
      paymentId,
      facts: razorpayFacts(payment),
      status,
      via: "webhook",
    });

    // The webhook entity is usually complete, but not always (some methods
    // report contact details only once settled). Go get them if they're missing.
    if (captured && (!doc?.email || !doc?.contact)) {
      await backfillContact(orderId);
    }

    // Notify once, only on a real capture. The claim is atomic against /verify,
    // and the doc it returns carries whatever the backfill just recovered.
    if (captured) {
      const record = await claimNotification(orderId);
      if (record) {
        await notifyOwnerOfPayment({
          orderId,
          paymentId,
          amount:
            (record.amountCaptured as number) ?? (record.amount as number) ?? 0,
          currency:
            (record.currencyCaptured as string) ??
            (record.currency as string) ??
            "",
          country: (record.country as string | null) ?? null,
          source: (record.source as string | null) ?? "webhook",
          method: (record.method as string) || null,
          email: (record.email as string) || null,
          contact: (record.contact as string) || null,
          message: (record.message as string) || null,
        });
      }
    }

    // Backup conversion to GA4 for closed-tab payments (once per order).
    if (captured) {
      await reportPaymentToGa(orderId);
      await linkPaymentToJourney(orderId);
    }
  } catch (error) {
    // Return 500 so Razorpay retries the webhook.
    console.error("support/webhook error:", error);
    return NextResponse.json({ message: "Processing error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
