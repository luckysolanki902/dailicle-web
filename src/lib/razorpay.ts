import crypto from "crypto";
import {
  emptyFacts,
  normalizeContactBasic,
  normalizeEmailBasic,
  type PaymentFacts,
} from "./payment-facts";

/**
 * Thin, dependency-free Razorpay helpers. We talk to the REST API directly with
 * Basic auth rather than pulling the SDK, and do all signature verification with
 * Node's crypto. Everything here is server-only secrets never leave the box.
 */

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export function getKeyId(): string {
  if (!KEY_ID) throw new Error("Missing RAZORPAY_KEY_ID");
  return KEY_ID;
}

function authHeader(): string {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET");
  }
  return "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export async function createOrder(params: {
  amount: number; // subunits
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes ?? {},
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay order failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * GET a Razorpay endpoint with a couple of retries. The reader's email/phone
 * only exists on Razorpay's side, so a transient 429/5xx here used to mean we
 * silently lost the contact details for that payment forever. Retry the failures
 * that are worth retrying; fail fast on 4xx, which will never get better.
 */
async function apiGet(path: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`https://api.razorpay.com/v1${path}`, {
        headers: { Authorization: authHeader() },
        cache: "no-store",
      });
      if (res.ok) return await res.json();

      const detail = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new Error(`Razorpay GET ${path} failed (${res.status}): ${detail}`);
      if (!retryable) throw lastError;
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw lastError;
}

/** Fetch the captured payment so we can store the real, authoritative record. */
export async function fetchPayment(
  paymentId: string
): Promise<Record<string, unknown>> {
  return (await apiGet(
    `/payments/${encodeURIComponent(paymentId)}`
  )) as Record<string, unknown>;
}

/**
 * Every payment attempt made against an order, newest first as Razorpay returns
 * them. This is the recovery path: given only an order id we can still find the
 * attempt that carries the reader's email/phone, even if we never learned the
 * payment id (browser closed before /verify, webhook lost, fetch failed).
 */
export async function fetchOrderPayments(
  orderId: string
): Promise<Record<string, unknown>[]> {
  const body = (await apiGet(
    `/orders/${encodeURIComponent(orderId)}/payments`
  )) as { items?: unknown };
  return Array.isArray(body.items)
    ? (body.items as Record<string, unknown>[])
    : [];
}

/**
 * Razorpay never returns "no email" — when Checkout is configured not to ask, or
 * the field is skipped, it substitutes its own placeholders (void@razorpay.com,
 * +919999999999). Storing those is worse than storing nothing: they look like
 * real contact details and quietly poison every downstream count. Normalize them
 * to null so "we have a way to reach this supporter" stays an honest signal.
 */
const PLACEHOLDER_EMAILS = new Set(["void@razorpay.com", "void@razorpay.in"]);
const PLACEHOLDER_CONTACTS = new Set([
  "+919999999999",
  "919999999999",
  "9999999999",
  "+910000000000",
  "0000000000",
]);

export function normalizeEmail(value: unknown): string | null {
  const email = normalizeEmailBasic(value);
  if (!email) return null;
  // Anything @razorpay.com is theirs, not the reader's.
  if (PLACEHOLDER_EMAILS.has(email) || email.endsWith("@razorpay.com")) {
    return null;
  }
  return email;
}

export function normalizeContact(value: unknown): string | null {
  const normalized = normalizeContactBasic(value);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (PLACEHOLDER_CONTACTS.has(normalized) || PLACEHOLDER_CONTACTS.has(digits)) {
    return null;
  }
  return normalized;
}

export interface PaymentContact {
  email: string | null;
  contact: string | null;
}

/**
 * Pull the reader's contact details out of a payment entity, checking every
 * place Razorpay is known to put them: the top-level fields first, then the
 * notes bag (which is where Checkout puts anything we prefilled), and finally
 * the UPI vpa, whose local part is often the only handle we get on UPI payments.
 */
export function contactFromPayment(
  payment: Record<string, unknown> | null | undefined
): PaymentContact {
  if (!payment) return { email: null, contact: null };

  const notes = (payment.notes ?? {}) as Record<string, unknown>;

  const email =
    normalizeEmail(payment.email) ??
    normalizeEmail(notes.email) ??
    normalizeEmail(notes.customer_email) ??
    null;

  const contact =
    normalizeContact(payment.contact) ??
    normalizeContact(notes.contact) ??
    normalizeContact(notes.phone) ??
    normalizeContact(notes.customer_contact) ??
    null;

  return { email, contact };
}

/**
 * Flatten a Razorpay payment entity into the provider-neutral shape the
 * supporter merge understands. Razorpay already speaks in subunits, so the
 * amounts pass through untouched.
 */
export function razorpayFacts(
  payment: Record<string, unknown> | null | undefined
): PaymentFacts {
  const facts = emptyFacts("razorpay");
  if (!payment || Object.keys(payment).length === 0) return facts;

  const { email, contact } = contactFromPayment(payment);
  facts.raw = payment;
  facts.paymentId = typeof payment.id === "string" ? payment.id : null;
  facts.email = email;
  facts.contact = contact;
  facts.method = typeof payment.method === "string" ? payment.method : null;
  facts.amountSubunits =
    typeof payment.amount === "number" ? payment.amount : null;
  facts.currency = typeof payment.currency === "string" ? payment.currency : null;
  facts.fee = typeof payment.fee === "number" ? payment.fee : null;
  facts.tax = typeof payment.tax === "number" ? payment.tax : null;
  return facts;
}

/** Rank payment attempts so the most meaningful one wins during recovery. */
export function paymentAttemptScore(payment: Record<string, unknown>): number {
  const status = String(payment.status || "");
  if (status === "captured") return 4;
  if (status === "refunded") return 3;
  if (status === "authorized") return 2;
  if (status === "created") return 1;
  return 0; // failed
}

/** timing-safe comparison of two hex signatures of equal expected length. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify the signature Razorpay Checkout returns to the browser after payment.
 * expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!KEY_SECRET) throw new Error("Missing RAZORPAY_KEY_SECRET");
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

/**
 * Verify a webhook payload against the x-razorpay-signature header using the
 * webhook secret. Must be given the raw request body string, not the parsed
 * object, or the HMAC will not match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!WEBHOOK_SECRET) throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}
