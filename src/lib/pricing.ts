/**
 * Server-authoritative pricing for the optional "support" flow.
 *
 * The client never decides how much is charged. It only ever sends a tier id
 * ("t1" | "t2" | "t3") or a custom amount in *major* units. The server maps
 * that to a currency + subunit amount here, based on the reader's country as
 * reported by Vercel's edge geolocation header (which the browser cannot forge).
 *
 * India sees INR (₹49 / ₹99 / ₹249). Everyone else sees USD ($3 / $5 / $15).
 * The middle tier is the gentle default the reader is shown.
 */

export type TierId = "t1" | "t2" | "t3";

export interface PriceConfig {
  currency: "INR" | "USD";
  symbol: string;
  /** Preset amounts in major units (rupees / dollars). */
  presets: Record<TierId, number>;
  /** Bounds for a custom "other" amount, in major units. */
  min: number;
  max: number;
}

const INDIA: PriceConfig = {
  currency: "INR",
  symbol: "₹",
  presets: { t1: 49, t2: 99, t3: 249 },
  min: 10,
  max: 500000,
};

const REST: PriceConfig = {
  currency: "USD",
  symbol: "$",
  presets: { t1: 3, t2: 5, t3: 15 },
  min: 1,
  max: 10000,
};

/** Resolve the price table for a two-letter ISO country code (or null). */
export function priceConfigFor(country: string | null): PriceConfig {
  return country === "IN" ? INDIA : REST;
}

export function isTierId(value: unknown): value is TierId {
  return value === "t1" || value === "t2" || value === "t3";
}

/**
 * Turn a validated request (tier or custom amount) into the exact amount to
 * charge. Returns amount in Razorpay subunits (paise / cents) plus the display
 * value. Throws on anything that cannot be priced so the caller returns 400.
 */
export function resolveAmount(
  cfg: PriceConfig,
  input: { tier?: unknown; amount?: unknown }
): { major: number; subunits: number; tier: TierId | "custom" } {
  if (isTierId(input.tier)) {
    const major = cfg.presets[input.tier];
    return { major, subunits: Math.round(major * 100), tier: input.tier };
  }

  const raw =
    typeof input.amount === "number"
      ? input.amount
      : typeof input.amount === "string"
        ? Number(input.amount)
        : NaN;

  if (!Number.isFinite(raw)) {
    throw new Error("No valid tier or amount provided.");
  }

  // Clamp into bounds and drop to whole units so a hostile client cannot
  // send fractional or absurd values.
  const major = Math.min(cfg.max, Math.max(cfg.min, Math.round(raw)));
  return { major, subunits: Math.round(major * 100), tier: "custom" };
}
