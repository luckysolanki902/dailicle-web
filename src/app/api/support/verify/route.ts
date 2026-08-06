import { NextRequest, NextResponse } from "next/server";
import {
  verifyCheckoutSignature,
  fetchPayment,
  razorpayFacts,
} from "@/lib/razorpay";
import {
  supportersCollection,
  notifyOwnerOfPayment,
  reportPaymentToGa,
  linkPaymentToJourney,
  recordPayment,
  backfillContact,
  claimNotification,
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

    // Enrich with the authoritative payment record from Razorpay. This is where
    // the reader's email/phone comes from, so a failure here is not "carry on
    // with nulls" — recordPayment merges rather than overwrites, and the
    // backfill below goes back for the contact details we missed.
    let payment: Record<string, unknown> = {};
    try {
      payment = await fetchPayment(paymentId);
    } catch (err) {
      console.error("verify: payment fetch failed:", err);
    }

    const col = await supportersCollection();

    const doc = await recordPayment({
      orderId,
      paymentId,
      facts: razorpayFacts(payment),
      status: (payment.status as string) === "captured" ? "captured" : "paid",
      via: "verify",
    });
    await col.updateOne({ orderId }, { $set: { verifiedAt: new Date() } });

    // If we still don't know how to reach them, ask Razorpay again by order id.
    if (!doc?.email || !doc?.contact) {
      await backfillContact(orderId);
    }

    // Notify once. The claim is atomic, so if the webhook already sent the mail
    // we get nothing back and stay quiet; the returned doc is also the freshest
    // read, i.e. it includes anything the backfill just recovered.
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
        source: (record.source as string | null) ?? null,
        method: (record.method as string) || null,
        email: (record.email as string) || null,
        contact: (record.contact as string) || null,
        message: (record.message as string) || null,
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
