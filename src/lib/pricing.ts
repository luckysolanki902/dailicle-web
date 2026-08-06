/**
 * Server-authoritative pricing for the optional "support" flow.
 *
 * The client never decides how much is charged. It only ever sends a tier id
 * ("t1" | "t2" | "t3") or a custom amount in *major* units. The server maps
 * that to a currency + subunit amount here, based on the reader's country as
 * reported by Vercel's edge geolocation header (which the browser cannot forge).
 *
 * Every reader is priced in their own currency at locally sensible, coffee-sized
 * amounts, then charged via Razorpay's international payments. Anything we don't
 * have an explicit table for falls back to USD, which Razorpay accepts globally.
 * The middle tier is the gentle default the reader is shown.
 *
 * IMPORTANT: currencies do not all use 1/100 subunits. Razorpay expects the
 * amount in the currency's smallest unit, so we carry a `decimals` exponent per
 * currency: 2 for most (paise/cents ×100), 0 for zero-decimal currencies like
 * JPY/KRW (×1), and 3 for the Gulf currencies KWD/BHD/OMR (×1000). Getting this
 * wrong charges the reader 100× too much or too little, so it lives with the
 * price table, not in the charge math.
 */

export type TierId = "t1" | "t2" | "t3";

export interface PriceConfig {
  /** ISO 4217 code passed straight to Razorpay (e.g. "USD", "INR", "KWD"). */
  currency: string;
  /** What the reader sees before the amount (e.g. "$", "₹", "AED "). */
  symbol: string;
  /** Preset amounts in major units (dollars / rupees / dinars …). */
  presets: Record<TierId, number>;
  /** Bounds for a custom "other" amount, in major units. */
  min: number;
  max: number;
  /** Subunit exponent: 2 → ×100, 0 → ×1 (JPY/KRW), 3 → ×1000 (Gulf). */
  decimals: number;
}

/** Compact builder so the table below reads as data, not boilerplate. */
function cfg(
  currency: string,
  symbol: string,
  presets: [number, number, number],
  min: number,
  max: number,
  decimals = 2
): PriceConfig {
  return {
    currency,
    symbol,
    presets: { t1: presets[0], t2: presets[1], t3: presets[2] },
    min,
    max,
    decimals,
  };
}

/**
 * Per-currency price tables, keyed by ISO 4217 code. Tiers are tuned to land
 * near a small / medium / generous "cup of coffee" in each economy rather than a
 * blind currency conversion, and rounded to amounts that feel natural locally.
 */
const CURRENCIES: Record<string, PriceConfig> = {
  USD: cfg("USD", "$", [3, 5, 15], 1, 10000),
  INR: cfg("INR", "₹", [49, 99, 249], 10, 500000),
  EUR: cfg("EUR", "€", [3, 5, 15], 1, 10000),
  GBP: cfg("GBP", "£", [3, 5, 12], 1, 10000),

  // Gulf. Riyal/dirham are 2-decimal; the dinars are 3-decimal.
  AED: cfg("AED", "AED ", [10, 20, 50], 5, 40000),
  SAR: cfg("SAR", "SAR ", [10, 20, 50], 5, 40000),
  QAR: cfg("QAR", "QAR ", [10, 20, 50], 5, 40000),
  KWD: cfg("KWD", "KWD ", [1, 2, 5], 1, 3000, 3),
  BHD: cfg("BHD", "BHD ", [1, 2, 5], 1, 4000, 3),
  OMR: cfg("OMR", "OMR ", [1, 2, 5], 1, 4000, 3),

  AUD: cfg("AUD", "A$", [5, 10, 25], 2, 15000),
  CAD: cfg("CAD", "C$", [5, 10, 25], 2, 15000),
  SGD: cfg("SGD", "S$", [4, 8, 20], 2, 14000),
  HKD: cfg("HKD", "HK$", [25, 50, 120], 10, 80000),
  NZD: cfg("NZD", "NZ$", [5, 10, 25], 2, 16000),
  CHF: cfg("CHF", "CHF ", [3, 5, 15], 1, 9000),

  ZAR: cfg("ZAR", "R", [50, 100, 250], 20, 180000),
  MYR: cfg("MYR", "RM", [15, 25, 70], 5, 45000),
  THB: cfg("THB", "฿", [100, 200, 500], 30, 350000),
  CNY: cfg("CNY", "CN¥", [20, 40, 100], 5, 70000),
  PHP: cfg("PHP", "₱", [150, 300, 850], 50, 550000),
  TRY: cfg("TRY", "₺", [100, 200, 500], 30, 300000),
  MXN: cfg("MXN", "MX$", [50, 100, 250], 20, 180000),
  BRL: cfg("BRL", "R$", [15, 30, 75], 5, 55000),

  PLN: cfg("PLN", "zł ", [12, 25, 60], 5, 40000),
  SEK: cfg("SEK", "kr ", [30, 60, 150], 10, 100000),
  NOK: cfg("NOK", "kr ", [30, 60, 150], 10, 100000),
  DKK: cfg("DKK", "kr ", [20, 40, 100], 7, 70000),

  // Zero-decimal: the amount is NOT multiplied out.
  JPY: cfg("JPY", "¥", [500, 800, 2000], 100, 1000000, 0),
  KRW: cfg("KRW", "₩", [4000, 7000, 20000], 1000, 10000000, 0),
};

const EUROZONE = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
];

/** ISO 3166-1 alpha-2 country → currency code. Anything absent → USD. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  AU: "AUD",
  CA: "CAD",
  SG: "SGD",
  HK: "HKD",
  NZ: "NZD",
  CH: "CHF",
  LI: "CHF",
  ZA: "ZAR",
  MY: "MYR",
  TH: "THB",
  CN: "CNY",
  PH: "PHP",
  TR: "TRY",
  MX: "MXN",
  BR: "BRL",
  PL: "PLN",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  JP: "JPY",
  KR: "KRW",
  ...Object.fromEntries(EUROZONE.map((c) => [c, "EUR"])),
};

/**
 * Subunits back to major units for a given currency. Not every currency is
 * 1/100: yen and won are whole units, the Gulf dinars are 1/1000. Reporting
 * ¥2000 as "20.00" understates real revenue by 100×, so anything converting a
 * stored amount for display or analytics must go through this.
 */
export function subunitsToMajor(subunits: number, currency: string): number {
  const decimals = CURRENCIES[currency?.toUpperCase()]?.decimals ?? 2;
  return subunits / 10 ** decimals;
}

/** Resolve the price table for a two-letter ISO country code (or null). */
export function priceConfigFor(country: string | null): PriceConfig {
  const code = country ? COUNTRY_TO_CURRENCY[country.toUpperCase()] : undefined;
  return (code && CURRENCIES[code]) || CURRENCIES.USD;
}

export function isTierId(value: unknown): value is TierId {
  return value === "t1" || value === "t2" || value === "t3";
}

/**
 * Turn a validated request (tier or custom amount) into the exact amount to
 * charge. Returns amount in Razorpay subunits (paise / cents / fils / whole
 * yen …) plus the display value. Throws on anything that cannot be priced so the
 * caller returns 400.
 */
export function resolveAmount(
  cfg: PriceConfig,
  input: { tier?: unknown; amount?: unknown }
): { major: number; subunits: number; tier: TierId | "custom" } {
  const factor = 10 ** cfg.decimals;

  if (isTierId(input.tier)) {
    const major = cfg.presets[input.tier];
    return { major, subunits: Math.round(major * factor), tier: input.tier };
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
  return { major, subunits: Math.round(major * factor), tier: "custom" };
}
