import { NextRequest, NextResponse } from "next/server";
import { getClientCountry, getClientIp } from "@/lib/request";
import { resolveAmount } from "@/lib/pricing";
import { supportPlanFor } from "@/lib/support-provider";
import { createPaypalOrder } from "@/lib/paypal";
import { supportersCollection } from "@/lib/supporters";

export const runtime = "nodejs";

const ALLOWED_SOURCES = new Set([
  "navbar",
  "footer",
  "reader",
  "dialog",
  "unknown",
]);

/**
 * Create a PayPal order — the non-Indian counterpart to /api/support/order.
 *
 * Deliberately the same shape as the Razorpay route: the amount is decided
 * here, never by the client, and the intent is written to the same `supporters`
 * document keyed by `orderId` so one collection, one admin view and one journey
 * link cover both gateways. The only difference is which id fills `orderId` —
 * here it is PayPal's order id.
 *
 * The gateway is re-derived server-side too. A client that asks for PayPal from
 * an Indian IP gets refused rather than quietly billed through the wrong one.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      tier?: unknown;
      amount?: unknown;
      source?: unknown;
      gaClientId?: unknown;
      vid?: unknown;
      sid?: unknown;
      essayId?: unknown;
      category?: unknown;
      message?: unknown;
    } | null;

    const str = (v: unknown, max = 128): string | null =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

    const country = getClientCountry(request);
    const plan = supportPlanFor(country);

    if (plan.provider !== "paypal") {
      return NextResponse.json(
        { message: "PayPal is not available for this region." },
        { status: 400 }
      );
    }

    let priced;
    try {
      priced = resolveAmount(plan.cfg, { tier: body?.tier, amount: body?.amount });
    } catch {
      return NextResponse.json(
        { message: "Please choose an amount to support with." },
        { status: 400 }
      );
    }

    const source =
      typeof body?.source === "string" && ALLOWED_SOURCES.has(body.source)
        ? body.source
        : "unknown";

    const receipt = `dl_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const order = await createPaypalOrder({
      subunits: priced.subunits,
      currency: plan.cfg.currency,
      reference: receipt,
      description: "Support The Dailicle",
    });

    // Record the intent up front so we have a full trail even if the reader
    // abandons checkout. Capture updates this same document by orderId.
    const col = await supportersCollection();
    const now = new Date();
    await col.updateOne(
      { orderId: order.id },
      {
        $setOnInsert: {
          orderId: order.id,
          createdAt: now,
          notified: false,
          status: "created",
          statusRank: 0,
          provider: "paypal",
        },
        $set: {
          amount: priced.subunits,
          currency: plan.cfg.currency,
          tier: priced.tier,
          country: country || null,
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          referer: request.headers.get("referer") || null,
          source,
          receipt,
          updatedAt: now,
          gaClientId: str(body?.gaClientId),
          // Anonymous visitor id — the join key to the reader journey.
          vid: str(body?.vid, 64),
          sid: str(body?.sid, 64),
          essayId: str(body?.essayId),
          category: str(body?.category, 32),
          message: str(body?.message, 500),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      orderId: order.id,
      display: priced.major,
      symbol: plan.cfg.symbol,
      currency: plan.cfg.currency,
    });
  } catch (error) {
    console.error("support/paypal/order error:", error);
    return NextResponse.json(
      { message: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
