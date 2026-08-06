import { NextRequest, NextResponse } from "next/server";
import {
  verifyPaypalWebhook,
  paypalWebhookConfigured,
  paypalFacts,
  fromPaypalAmount,
  getPaypalOrder,
} from "@/lib/paypal";
import { emptyFacts } from "@/lib/payment-facts";
import {
  notifyOwnerOfPayment,
  reportPaymentToGa,
  linkPaymentToJourney,
  recordPayment,
  claimNotification,
} from "@/lib/supporters";

export const runtime = "nodejs";

/**
 * PayPal's server-to-server source of truth, mirroring the Razorpay webhook.
 * Even if the browser never calls /capture — closed tab, blocked JS, a network
 * drop between approval and capture — this still records the payment.
 *
 * Unlike Razorpay's local HMAC, verification is a round trip to PayPal (their
 * signature uses a rotating certificate), so this route is a little slower and
 * fails closed: unverified events are dropped, never written.
 */

/** A capture resource names its order through the `supplementary_data` link. */
function orderIdFromResource(resource: Record<string, unknown>): string | null {
  const supplementary = (resource.supplementary_data ?? {}) as Record<string, unknown>;
  const related = (supplementary.related_ids ?? {}) as Record<string, unknown>;
  const fromRelated = related.order_id;
  if (typeof fromRelated === "string" && fromRelated) return fromRelated;

  // CHECKOUT.ORDER.* events carry the order itself.
  if (typeof resource.id === "string" && Array.isArray(resource.purchase_units)) {
    return resource.id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  let event: {
    event_type?: string;
    resource?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Bad payload." }, { status: 400 });
  }

  // Without a webhook id we cannot prove the sender is PayPal, so we must not
  // write. The browser capture path still records every payment.
  if (!paypalWebhookConfigured()) {
    console.error("PayPal webhook received but PAYPAL_WEBHOOK_ID is not set.");
    return NextResponse.json({ message: "Not configured." }, { status: 503 });
  }
  if (!(await verifyPaypalWebhook(request.headers, event))) {
    return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
  }

  const resource = event.resource ?? {};
  const type = event.event_type || "";

  const HANDLED = [
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.CAPTURE.DENIED",
    "PAYMENT.CAPTURE.REFUNDED",
    "CHECKOUT.ORDER.APPROVED",
  ];
  if (!HANDLED.includes(type)) return NextResponse.json({ received: true });

  const orderId = orderIdFromResource(resource);
  if (!orderId) return NextResponse.json({ received: true });

  const captured = type === "PAYMENT.CAPTURE.COMPLETED";

  try {
    // A capture event describes the capture, not the payer. Fetch the order so
    // we get the payer's email too — the whole reason this integration exists.
    let facts = emptyFacts("paypal");
    if (Array.isArray(resource.purchase_units)) {
      facts = paypalFacts(resource);
    } else {
      try {
        facts = paypalFacts(await getPaypalOrder(orderId));
      } catch (err) {
        console.error("paypal webhook: order fetch failed:", err);
      }
      // Fall back to the capture resource's own amount if the fetch failed.
      const amount = (resource.amount ?? {}) as Record<string, unknown>;
      facts.paymentId ??= typeof resource.id === "string" ? resource.id : null;
      facts.amountSubunits ??= fromPaypalAmount(amount.value, amount.currency_code);
      facts.currency ??=
        typeof amount.currency_code === "string" ? amount.currency_code : null;
      if (Object.keys(facts.raw).length === 0) facts.raw = resource;
    }

    const status =
      type === "PAYMENT.CAPTURE.DENIED"
        ? "failed"
        : captured
          ? "captured"
          : "authorized";

    const doc = await recordPayment({
      orderId,
      facts,
      // A refund leaves the payment captured; the refund itself is on the raw
      // record. Don't rewind the lifecycle for it.
      status: type === "PAYMENT.CAPTURE.REFUNDED" ? undefined : status,
      via: "webhook",
    });
    if (!doc) return NextResponse.json({ received: true });

    if (captured) {
      const record = await claimNotification(orderId);
      if (record) {
        await notifyOwnerOfPayment({
          orderId,
          paymentId: (record.paymentId as string) || undefined,
          amount:
            (record.amountCaptured as number) ?? (record.amount as number) ?? 0,
          currency:
            (record.currencyCaptured as string) ??
            (record.currency as string) ??
            "",
          country: (record.country as string | null) ?? null,
          source: (record.source as string | null) ?? "webhook",
          method: "paypal",
          email: (record.email as string) || null,
          contact: (record.contact as string) || null,
          message: (record.message as string) || null,
        });
      }
      await reportPaymentToGa(orderId);
      await linkPaymentToJourney(orderId);
    }
  } catch (error) {
    // 500 so PayPal retries.
    console.error("support/paypal/webhook error:", error);
    return NextResponse.json({ message: "Processing error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
