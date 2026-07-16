import crypto from "crypto";

/**
 * Thin, dependency-free Razorpay helpers. We talk to the REST API directly with
 * Basic auth rather than pulling the SDK, and do all signature verification with
 * Node's crypto. Everything here is server-only — secrets never leave the box.
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

/** Fetch the captured payment so we can store the real, authoritative record. */
export async function fetchPayment(
  paymentId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: authHeader() } }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay payment fetch failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as Record<string, unknown>;
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
