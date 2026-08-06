import { priceConfigFor, type PriceConfig } from "@/lib/pricing";
import { PAYPAL_CURRENCIES, paypalConfigured } from "@/lib/paypal";
import type { PaymentProvider } from "@/lib/payment-facts";

/**
 * Who processes a given reader's support, and in which currency.
 *
 * PayPal is the default. Razorpay is used only when we are *sure* the reader is
 * in India, because that account is an Indian one with no international
 * acceptance: it settles INR and nothing else. A reader in Berlin used to be
 * quoted €5 and then offered UPI and forty-five Indian netbanking options,
 * which is why every non-INR order ever created was abandoned without a single
 * payment attempt.
 *
 * "Sure" means the edge geolocation header actually said IN. An absent or
 * unrecognised country is *not* India — it falls through to PayPal, which can
 * at least take the money from anyone, rather than to a gateway that would
 * quote a currency it cannot settle. Guessing wrong toward PayPal costs a
 * reader nothing; guessing wrong toward Razorpay costs the whole payment.
 */

export interface SupportPlan {
  provider: PaymentProvider;
  /** The price table actually used — may differ from the reader's local one. */
  cfg: PriceConfig;
  /**
   * Set when the reader's own currency had to be swapped out because PayPal
   * will not settle it (dirhams, riyals, rand, lira, yuan…).
   */
  originalCurrency: string | null;
}

/** PayPal settles this currency cross-border. */
export function paypalSupports(currency: string): boolean {
  return Object.hasOwn(PAYPAL_CURRENCIES, currency);
}

/** Only a positive, unambiguous "IN" counts. Null/unknown is not India. */
export function isIndianReader(country: string | null): boolean {
  return (country ?? "").trim().toUpperCase() === "IN";
}

/**
 * Decide the gateway and price table for a reader's country.
 *
 * If PayPal is not configured at all, everything falls back to Razorpay. That
 * is deliberately the *safe* failure: a missing env var degrades to the old
 * behaviour rather than showing a checkout that cannot work.
 */
export function supportPlanFor(country: string | null): SupportPlan {
  const local = priceConfigFor(country);

  if (isIndianReader(country) || !paypalConfigured()) {
    return { provider: "razorpay", cfg: local, originalCurrency: null };
  }

  if (paypalSupports(local.currency)) {
    return { provider: "paypal", cfg: local, originalCurrency: null };
  }

  // PayPal cannot settle their local currency — quote in USD instead, using the
  // USD tiers rather than a converted local amount, so the reader still sees
  // round, sensible numbers ($3 / $5 / $15) instead of "$13.61".
  return {
    provider: "paypal",
    cfg: priceConfigFor("US"),
    originalCurrency: local.currency,
  };
}
