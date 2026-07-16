import { NextRequest, NextResponse } from "next/server";
import { getClientCountry } from "@/lib/request";
import { priceConfigFor } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Tells the dialog what to show: currency, symbol, the three preset amounts and
 * the bounds for a custom amount — all derived server-side from the reader's
 * edge country. Display only; the order endpoint re-derives the real charge.
 */
export async function GET(request: NextRequest) {
  const country = getClientCountry(request);
  const cfg = priceConfigFor(country);
  return NextResponse.json({
    currency: cfg.currency,
    symbol: cfg.symbol,
    country: country || null,
    presets: cfg.presets,
    min: cfg.min,
    max: cfg.max,
  });
}
