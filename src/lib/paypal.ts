import {
  emptyFacts,
  normalizeContactBasic,
  normalizeEmailBasic,
  type PaymentFacts,
} from "./payment-facts";

/**
 * Thin PayPal Orders v2 client, in the same spirit as `razorpay.ts`: no SDK,
 * direct REST, secrets never leaving the server.
 *
 * PayPal is what non-Indian readers pay through. Razorpay's account is an
 * Indian one without international acceptance, so a reader in the US used to be
 * handed a USD order and then offered UPI and Indian netbanking — which is why
 * every non-INR order died with zero payment attempts.
 *
 * Two things differ from Razorpay and both are easy to get wrong:
 *
 *  1. PayPal talks in *major* units as decimal strings ("5.00"), not minor
 *     units as integers. Everything else in this codebase — pricing, the
 *     supporters collection, the admin — is in subunits, so the conversion is
 *     done here at the boundary and nowhere else.
 *  2. PayPal does not support every currency in our price table, and the
 *     zero-decimal set is different too. See `support-provider.ts` for the
 *     mapping; by the time an amount reaches this module the currency is
 *     already known-good.
 */

const LIVE_BASE = "https://api-m.paypal.com";
const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

/** Live only when explicitly asked for — an unset env must never bill anyone. */
export function isLive(): boolean {
  return (process.env.PAYPAL_ENV || "sandbox").toLowerCase() === "live";
}

function apiBase(): string {
  return isLive() ? LIVE_BASE : SANDBOX_BASE;
}

/** Whether PayPal can be offered at all. Missing keys must degrade, not throw. */
export function paypalConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

/** The public client id the browser SDK needs. */
export function getPaypalClientId(): string {
  if (!CLIENT_ID) throw new Error("Missing PAYPAL_CLIENT_ID");
  return CLIENT_ID;
}

/**
 * Currencies PayPal will settle cross-border, with how many decimal places each
 * takes. PayPal rejects an amount carrying more precision than the currency
 * allows, so "1000.00" for JPY is an error, not a rounding nicety.
 */
export const PAYPAL_CURRENCIES: Record<string, number> = {
  AUD: 2, CAD: 2, CHF: 2, CZK: 2, DKK: 2, EUR: 2, GBP: 2, HKD: 2,
  ILS: 2, MXN: 2, NOK: 2, NZD: 2, PHP: 2, PLN: 2, SEK: 2, SGD: 2,
  THB: 2, USD: 2,
  // Zero-decimal: the value is sent as a whole number.
  HUF: 0, JPY: 0, TWD: 0,
};

/** Subunits → the decimal string PayPal expects ("5.00", or "500" for JPY). */
export function toPaypalAmount(subunits: number, currency: string): string {
  const decimals = PAYPAL_CURRENCIES[currency] ?? 2;
  const major = subunits / 10 ** decimals;
  return major.toFixed(decimals);
}

/** PayPal's decimal string → subunits, the unit everything else here uses. */
export function fromPaypalAmount(
  value: unknown,
  currency: unknown
): number | null {
  const n = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const code = typeof currency === "string" ? currency.toUpperCase() : "USD";
  const decimals = PAYPAL_CURRENCIES[code] ?? 2;
  return Math.round(n * 10 ** decimals);
}

/* ------------------------------------------------------------------ auth */

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * OAuth2 client-credentials token, cached until shortly before it expires.
 * PayPal tokens last ~9 hours; fetching one per request would add a round trip
 * to every checkout for no reason.
 */
async function accessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  }
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed (${res.status}): ${detail}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    // Retire it a minute early rather than risk a request on a dead token.
    expiresAt: Date.now() + Math.max(0, body.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function api(
  path: string,
  init: { method?: string; body?: unknown; requestId?: string } = {}
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
  };
  // Idempotency: PayPal replays the original result instead of charging twice
  // if the same request id arrives again (a retry, a double-clicked button).
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;

  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`PayPal ${init.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return parsed as Record<string, unknown>;
}

/* ---------------------------------------------------------------- orders */

export interface PaypalOrder {
  id: string;
  status: string;
}

/**
 * Create an order for exactly the amount the server decided. `reference` is our
 * own receipt id, echoed back on capture and in webhooks so a payment can
 * always be traced to the supporter record that started it.
 */
export async function createPaypalOrder(params: {
  subunits: number;
  currency: string;
  reference: string;
  description: string;
}): Promise<PaypalOrder> {
  const body = await api("/v2/checkout/orders", {
    method: "POST",
    requestId: params.reference,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.reference,
          custom_id: params.reference,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: params.currency,
            value: toPaypalAmount(params.subunits, params.currency),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            brand_name: "The Dailicle",
          },
        },
      },
    },
  });
  return { id: String(body.id), status: String(body.status ?? "") };
}

/** Capture an approved order. This is the call that actually takes the money. */
export async function capturePaypalOrder(
  orderId: string
): Promise<Record<string, unknown>> {
  return await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    // Same id on a retry returns the original capture instead of charging again.
    requestId: `capture_${orderId}`,
    body: {},
  });
}

/** Read an order back — the recovery path when a capture response was lost. */
export async function getPaypalOrder(
  orderId: string
): Promise<Record<string, unknown>> {
  return await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

/* -------------------------------------------------------------- webhooks */

export function paypalWebhookConfigured(): boolean {
  return Boolean(WEBHOOK_ID && paypalConfigured());
}

/**
 * Verify a webhook with PayPal itself. Unlike Razorpay's local HMAC, PayPal
 * signs with a rotating certificate, so the only sound check is to hand the
 * headers plus the parsed event back to PayPal and ask. Returns false on any
 * doubt — an unverified event must never be allowed to write.
 */
export async function verifyPaypalWebhook(
  headers: Headers,
  event: unknown
): Promise<boolean> {
  if (!WEBHOOK_ID) return false;
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ] as const;
  const got: Record<string, string> = {};
  for (const h of required) {
    const v = headers.get(h);
    if (!v) return false;
    got[h] = v;
  }

  try {
    const body = await api("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: got["paypal-auth-algo"],
        cert_url: got["paypal-cert-url"],
        transmission_id: got["paypal-transmission-id"],
        transmission_sig: got["paypal-transmission-sig"],
        transmission_time: got["paypal-transmission-time"],
        webhook_id: WEBHOOK_ID,
        webhook_event: event,
      },
    });
    return body.verification_status === "SUCCESS";
  } catch (err) {
    console.error("PayPal webhook verification failed:", err);
    return false;
  }
}

/* ----------------------------------------------------------------- facts */

function str(v: unknown, max = 254): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/** Dig the completed capture out of an order/capture response, if there is one. */
function firstCapture(order: Record<string, unknown>): Record<string, unknown> | null {
  const units = order.purchase_units;
  if (!Array.isArray(units)) return null;
  for (const unit of units) {
    const captures = (unit as Record<string, unknown>)?.payments as
      | Record<string, unknown>
      | undefined;
    const list = captures?.captures;
    if (Array.isArray(list) && list.length) {
      return list[0] as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Flatten a PayPal order (or capture response) into the provider-neutral shape
 * the supporter merge understands.
 *
 * PayPal reliably gives an email — it is the account they paid with — and that
 * is worth noting, because Razorpay's UPI flow gives one only rarely. A phone
 * number only appears if the account has one shared, so it is usually null.
 */
export function paypalFacts(
  order: Record<string, unknown> | null | undefined
): PaymentFacts {
  const facts = emptyFacts("paypal");
  if (!order) return facts;

  facts.raw = order;
  facts.method = "paypal";

  const payer = (order.payer ?? {}) as Record<string, unknown>;
  facts.email = normalizeEmailBasic(payer.email_address);

  const phone = (payer.phone ?? {}) as Record<string, unknown>;
  const number = (phone.phone_number ?? {}) as Record<string, unknown>;
  const national = str(number.national_number, 20);
  const code = str((phone as Record<string, unknown>).country_code, 5);
  facts.contact = normalizeContactBasic(
    national ? (code ? `+${code}${national}` : national) : null
  );

  const capture = firstCapture(order);
  if (capture) {
    facts.paymentId = str(capture.id, 64);
    const amount = (capture.amount ?? {}) as Record<string, unknown>;
    facts.currency = str(amount.currency_code, 8);
    facts.amountSubunits = fromPaypalAmount(amount.value, amount.currency_code);

    const breakdown = (capture.seller_receivable_breakdown ?? {}) as Record<
      string,
      unknown
    >;
    const fee = (breakdown.paypal_fee ?? {}) as Record<string, unknown>;
    facts.fee = fromPaypalAmount(fee.value, fee.currency_code ?? amount.currency_code);
  } else {
    // Not captured yet — the order still carries the intended amount.
    const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
    const amount = ((units[0] as Record<string, unknown>)?.amount ?? {}) as Record<
      string,
      unknown
    >;
    facts.currency = str(amount.currency_code, 8);
    facts.amountSubunits = fromPaypalAmount(amount.value, amount.currency_code);
  }

  return facts;
}

/** Our own reference, echoed back by PayPal on capture and in webhook events. */
export function referenceFrom(order: Record<string, unknown>): string | null {
  const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  const unit = (units[0] ?? {}) as Record<string, unknown>;
  return str(unit.custom_id, 64) ?? str(unit.reference_id, 64);
}
