import { NextRequest, NextResponse } from "next/server";
import { verifyCheckoutSignature, fetchPayment } from "@/lib/razorpay";
import {
  supportersCollection,
  notifyOwnerOfPayment,
  reportPaymentToGa,
  linkPaymentToJourney,
} from "@/lib/supporters";

export const runtime = "nodejs";

/**
 * Called by the browser right after Checkout succeeds. This confirms the
 * payment to the reader quickly, but is NOT trusted blindly: we verify the
 * HMAC signature (which cannot be forged without the key secret) before
 * recording anything. The webhook is the redundant source of truth.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      razorpay_order_id?: unknown;
      razorpay_payment_id?: unknown;
      razorpay_signature?: unknown;
    } | null;

    const orderId = String(body?.razorpay_order_id || "");
    const paymentId = String(body?.razorpay_payment_id || "");
    const signature = String(body?.razorpay_signature || "");

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ message: "Invalid payment." }, { status: 400 });
    }

    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return NextResponse.json(
        { message: "Payment could not be verified." },
        { status: 400 }
      );
    }

    // Enrich with the authoritative payment record from Razorpay.
    let payment: Record<string, unknown> = {};
    try {
      payment = await fetchPayment(paymentId);
    } catch (err) {
      console.error("verify: payment fetch failed:", err);
    }

    const col = await supportersCollection();
    const now = new Date();
    const existing = await col.findOne({ orderId });

    await col.updateOne(
      { orderId },
      {
        $set: {
          paymentId,
          status: "paid",
          verifiedAt: now,
          updatedAt: now,
          method: (payment.method as string) || null,
          email: (payment.email as string) || null,
          contact: (payment.contact as string) || null,
          fee: (payment.fee as number) ?? null,
          tax: (payment.tax as number) ?? null,
          amountCaptured: (payment.amount as number) ?? null,
          currencyCaptured: (payment.currency as string) ?? null,
          razorpay: payment,
        },
      }
    );

    // Notify once. If the webhook hasn't beaten us to it, do it here.
    if (existing && !existing.notified) {
      await col.updateOne({ orderId }, { $set: { notified: true } });
      await notifyOwnerOfPayment({
        orderId,
        paymentId,
        amount: (payment.amount as number) ?? (existing.amount as number),
        currency:
          (payment.currency as string) ?? (existing.currency as string),
        country: existing.country as string | null,
        source: existing.source as string | null,
        method: (payment.method as string) || null,
        email: (payment.email as string) || null,
        contact: (payment.contact as string) || null,
        message: (existing.message as string) || null,
      });
    }

    // Authoritative conversion to GA4 (once per order; webhook is the backup).
    await reportPaymentToGa(orderId);
    // Close the loop on the anonymous reading journey that led here.
    await linkPaymentToJourney(orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("support/verify error:", error);
    return NextResponse.json(
      { message: "Could not verify the payment." },
      { status: 500 }
    );
  }
}
