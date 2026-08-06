import { NextRequest, NextResponse } from "next/server";
import { getClientCountry, getClientIp } from "@/lib/request";
import { priceConfigFor, resolveAmount } from "@/lib/pricing";
import { createOrder, getKeyId } from "@/lib/razorpay";
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
 * Create a Razorpay order. The amount is decided here, never by the client:
 * the client sends a tier id or a custom amount, we clamp/map it against the
 * server price table for the reader's country, and create the order for exactly
 * that. Returns the order id + public key id for Checkout.
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

    // Small helper: keep only sane, length-capped strings for analytics fields.
    const str = (v: unknown, max = 128): string | null =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

    const country = getClientCountry(request);
    const cfg = priceConfigFor(country);

    let priced;
    try {
      priced = resolveAmount(cfg, { tier: body?.tier, amount: body?.amount });
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

    const order = await createOrder({
      amount: priced.subunits,
      currency: cfg.currency,
      receipt,
      notes: {
        country: country || "unknown",
        source,
        tier: priced.tier,
      },
    });

    // Record the intent up front so we have a full trail even if the reader
    // abandons Checkout. Capture updates this same document by orderId.
    const col = await supportersCollection();
    const now = new Date();
    await col.updateOne(
      { orderId: order.id },
      {
        $setOnInsert: {
          orderId: order.id,
          createdAt: now,
          notified: false,
          // Lifecycle position, so later writes can only move it forward.
          status: "created",
          statusRank: 0,
        },
        $set: {
          amount: priced.subunits,
          currency: cfg.currency,
          tier: priced.tier,
          country: country || null,
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          referer: request.headers.get("referer") || null,
          source,
          receipt,
          updatedAt: now,
          gaClientId: str(body?.gaClientId),
          // Anonymous visitor id — the join key to the reader journey, which is
          // what turns this row into "who they were before they paid".
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
      amount: order.amount,
      currency: order.currency,
      keyId: getKeyId(),
      display: priced.major,
      symbol: cfg.symbol,
    });
  } catch (error) {
    console.error("support/order error:", error);
    return NextResponse.json(
      { message: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
