/**
 * What a supporter record needs to know about a payment, independent of who
 * processed it.
 *
 * Razorpay and PayPal describe the same event in completely different shapes —
 * different field names, different money representations, contact details in
 * different corners of the response. Rather than teach the merge layer both
 * dialects, each provider flattens its own response into this, and everything
 * downstream (the Mongo merge, the owner email, the admin) speaks only this.
 *
 * Every field is nullable on purpose: a provider that does not tell us
 * something must produce `null`, never a guess and never a placeholder. The
 * merge treats null as "this write learned nothing here" and keeps whatever is
 * already stored, which is the rule that stops a failed fetch from erasing a
 * supporter's email.
 *
 * Its own module, with no imports, so both provider clients can depend on it
 * without importing each other.
 */

export type PaymentProvider = "razorpay" | "paypal";

export interface PaymentFacts {
  provider: PaymentProvider;
  /** The provider's id for the payment itself (not the order). */
  paymentId: string | null;
  email: string | null;
  contact: string | null;
  /** How they paid, in the provider's vocabulary ("upi", "card", "paypal"). */
  method: string | null;
  /** Minor units (paise/cents), matching how the order was priced. */
  amountSubunits: number | null;
  currency: string | null;
  /** Processor fee in minor units, when the provider discloses it. */
  fee: number | null;
  tax: number | null;
  /** The provider's untouched response, kept for auditing. */
  raw: Record<string, unknown>;
}

/**
 * Normalize an email the same way for every gateway.
 *
 * Case matters more than it looks: the admin groups a supporter's orders by
 * their contact details, so storing "Reader@Example.com" from PayPal and
 * "reader@example.com" from Razorpay would split one person into two.
 * Providers layer their own rules on top (Razorpay rejects its placeholders);
 * this is the shared floor.
 */
export function normalizeEmailBasic(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email === "void") return null;
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 254);
}

/** Digits plus an optional leading "+", or null if it cannot be a number. */
export function normalizeContactBasic(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.toLowerCase() === "void") return null;

  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  // A run of one repeated digit is never a real number.
  if (/^(\d)\1+$/.test(digits)) return null;
  return (plus ? "+" : "") + digits;
}

export function emptyFacts(provider: PaymentProvider): PaymentFacts {
  return {
    provider,
    paymentId: null,
    email: null,
    contact: null,
    method: null,
    amountSubunits: null,
    currency: null,
    fee: null,
    tax: null,
    raw: {},
  };
}
