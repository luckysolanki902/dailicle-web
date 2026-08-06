import { NextRequest, NextResponse } from "next/server";
import {
  capturePaypalOrder,
  getPaypalOrder,
  paypalFacts,
} from "@/lib/paypal";
import {
  supportersCollection,
  notifyOwnerOfPayment,
  reportPaymentToGa,
  linkPaymentToJourney,
  recordPayment,
  claimNotification,
} from "@/lib/supporters";

export const runtime = "nodejs";

/**
 * Take the money. Called by the browser once the reader approves in the PayPal
 * popup — the counterpart to Razorpay's /verify, but doing rather more work:
 * with Razorpay the payment already happened and we only confirm it, whereas
 * here the capture *is* the charge.
 *
 * There is no signature to check, because nothing the client sends is trusted
 * in the first place. The order id is looked up in our own collection, and the
 * amount comes from PayPal's response, not the request body — so a forged
 * order id belonging to nobody simply captures nothing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      orderId?: unknown;
    } | null;

    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return NextResponse.json({ message: "Invalid payment." }, { status: 400 });
    }

    const col = await supportersCollection();
    const existing = await col.findOne({ orderId });
    // We only capture orders we created. Anything else is not ours to charge.
    if (!existing || existing.provider !== "paypal") {
      return NextResponse.json({ message: "Unknown order." }, { status: 404 });
    }

    let captured: Record<string, unknown>;
    try {
      captured = await capturePaypalOrder(orderId);
    } catch (err) {
      // A capture can fail because it *already* succeeded (a double-submitted
      // button, a retry). Read the order back before calling it a failure —
      // reporting an error on money that actually moved is the worse mistake.
      console.error("paypal capture failed, re-reading order:", err);
      try {
        captured = await getPaypalOrder(orderId);
      } catch {
        return NextResponse.json(
          { message: "Could not complete the payment." },
          { status: 502 }
        );
      }
    }

    const facts = paypalFacts(captured);
    const completed = String(captured.status || "").toUpperCase() === "COMPLETED";

    await recordPayment({
      orderId,
      facts,
      status: completed ? "captured" : "authorized",
      via: "capture",
    });
    await col.updateOne({ orderId }, { $set: { verifiedAt: new Date() } });

    if (!completed) {
      // Approved but not captured — the webhook will finish the job if PayPal
      // completes it asynchronously.
      return NextResponse.json({ success: false, status: captured.status });
    }

    // Notify once. The claim is atomic against the webhook: if it already sent
    // the mail we get nothing back and stay quiet.
    const record = await claimNotification(orderId);
    if (record) {
      await notifyOwnerOfPayment({
        orderId,
        paymentId: facts.paymentId ?? undefined,
        amount:
          (record.amountCaptured as number) ?? (record.amount as number) ?? 0,
        currency:
          (record.currencyCaptured as string) ??
          (record.currency as string) ??
          "",
        country: (record.country as string | null) ?? null,
        source: (record.source as string | null) ?? null,
        method: "paypal",
        email: (record.email as string) || null,
        contact: (record.contact as string) || null,
        message: (record.message as string) || null,
      });
    }

    await reportPaymentToGa(orderId);
    await linkPaymentToJourney(orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("support/paypal/capture error:", error);
    return NextResponse.json(
      { message: "Could not complete the payment." },
      { status: 500 }
    );
  }
}
