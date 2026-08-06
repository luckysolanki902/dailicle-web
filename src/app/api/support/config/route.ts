import { NextRequest, NextResponse } from "next/server";
import { getClientCountry } from "@/lib/request";
import { supportPlanFor } from "@/lib/support-provider";
import { getPaypalClientId, isLive, paypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";

/**
 * Tells the dialog what to show: which gateway to open, the currency, symbol,
 * the three preset amounts and the bounds for a custom amount — all derived
 * server-side from the reader's edge country. Display only; the order endpoint
 * re-derives both the gateway and the real charge, so a client that lies about
 * either gets nowhere.
 */
export async function GET(request: NextRequest) {
  const country = getClientCountry(request);
  const { provider, cfg, originalCurrency } = supportPlanFor(country);

  return NextResponse.json({
    provider,
    currency: cfg.currency,
    symbol: cfg.symbol,
    country: country || null,
    presets: cfg.presets,
    min: cfg.min,
    max: cfg.max,
    // Set when the reader's own currency is one PayPal will not settle, so the
    // dialog can say why the amounts are in dollars.
    originalCurrency,
    // The PayPal client id is public by design — the browser SDK needs it in a
    // script URL. The secret never leaves the server.
    paypalClientId:
      provider === "paypal" && paypalConfigured() ? getPaypalClientId() : null,
    paypalEnv: provider === "paypal" ? (isLive() ? "live" : "sandbox") : null,
  });
}
