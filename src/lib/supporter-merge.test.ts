import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentMerge } from "./supporter-merge";
import { normalizeContact, normalizeEmail, razorpayFacts } from "./razorpay";
import { emptyFacts } from "./payment-facts";
import { paypalFacts, toPaypalAmount, fromPaypalAmount } from "./paypal";

/**
 * A minimal evaluator for the handful of aggregation operators the merge
 * pipeline uses ($set with field paths, $literal, $ifNull, $cond, $gt, $max).
 * It models MongoDB's documented semantics — notably that a path to a missing
 * field evaluates to "missing", and that assigning a missing value leaves the
 * field absent — so the tests below can assert what a document actually looks
 * like after two writers race, without needing a live database.
 */
const MISSING = Symbol("missing");

function evalExpr(expr: unknown, doc: Record<string, unknown>): unknown {
  if (typeof expr === "string" && expr.startsWith("$")) {
    const key = expr.slice(1);
    return key in doc ? doc[key] : MISSING;
  }
  if (expr === null || typeof expr !== "object" || Array.isArray(expr)) {
    return expr;
  }
  const e = expr as Record<string, unknown>;
  if ("$literal" in e) return e.$literal;
  if ("$ifNull" in e) {
    const [a, b] = e.$ifNull as [unknown, unknown];
    const v = evalExpr(a, doc);
    return v === MISSING || v === null ? evalExpr(b, doc) : v;
  }
  if ("$cond" in e) {
    const [c, t, f] = e.$cond as [unknown, unknown, unknown];
    return evalExpr(c, doc) ? evalExpr(t, doc) : evalExpr(f, doc);
  }
  if ("$gt" in e) {
    const [a, b] = e.$gt as [unknown, unknown];
    const l = evalExpr(a, doc);
    const r = evalExpr(b, doc);
    return (l === MISSING ? -Infinity : (l as number)) >
      (r === MISSING ? -Infinity : (r as number));
  }
  if ("$max" in e) {
    const vals = (e.$max as unknown[])
      .map((v) => evalExpr(v, doc))
      .filter((v) => v !== MISSING && v !== null) as number[];
    return vals.length ? Math.max(...vals) : MISSING;
  }
  return expr;
}

/** Apply a built pipeline to a document, as updateOne(..., pipeline) would. */
function apply(
  doc: Record<string, unknown>,
  pipeline: Record<string, unknown>[]
): Record<string, unknown> {
  let out = { ...doc };
  for (const stage of pipeline) {
    const set = stage.$set as Record<string, unknown>;
    // All expressions in a $set stage see the *pre-stage* document.
    const snapshot = { ...out };
    for (const [field, expr] of Object.entries(set)) {
      const value = evalExpr(expr, snapshot);
      if (value === MISSING) delete out[field];
      else out = { ...out, [field]: value };
    }
  }
  return out;
}

const capturedPayment = {
  id: "pay_real",
  order_id: "order_1",
  status: "captured",
  method: "upi",
  amount: 50000,
  currency: "INR",
  fee: 1180,
  tax: 180,
  email: "Reader@Example.com",
  contact: "+91 98765 43210",
};

test("Razorpay's placeholder contact details are treated as no details", () => {
  assert.equal(normalizeEmail("void@razorpay.com"), null);
  assert.equal(normalizeEmail("VOID@Razorpay.com"), null);
  assert.equal(normalizeContact("+919999999999"), null);
  assert.equal(normalizeContact("9999999999"), null);
  assert.equal(normalizeContact("0000000000"), null);

  // Real ones survive, normalized.
  assert.equal(normalizeEmail("  Reader@Example.COM "), "reader@example.com");
  assert.equal(normalizeContact("+91 98765-43210"), "+919876543210");
  assert.equal(normalizeContact("(415) 555 0132"), "4155550132");

  // Junk is rejected rather than stored as if it were a way to reach someone.
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeContact("12"), null);
});

test("a failed payment fetch cannot erase contact details we already have", () => {
  // The webhook lands first with the real entity.
  const fromWebhook = apply(
    {},
    buildPaymentMerge({
      orderId: "order_1",
      paymentId: "pay_real",
      facts: razorpayFacts(capturedPayment),
      status: "captured",
      via: "webhook",
    }).pipeline
  );
  assert.equal(fromWebhook.email, "reader@example.com");
  assert.equal(fromWebhook.contact, "+919876543210");

  // Then /verify runs, but its fetch to Razorpay failed, so it has nothing.
  // This is the exact case that used to null the fields out.
  const afterVerify = apply(
    fromWebhook,
    buildPaymentMerge({
      orderId: "order_1",
      paymentId: "pay_real",
      facts: emptyFacts("razorpay"),
      status: "paid",
      via: "verify",
    }).pipeline
  );

  assert.equal(afterVerify.email, "reader@example.com");
  assert.equal(afterVerify.contact, "+919876543210");
  assert.equal(afterVerify.method, "upi");
  assert.equal(afterVerify.amountCaptured, 50000);
  assert.deepEqual(afterVerify.razorpay, capturedPayment);
  // ...and the empty write did not rewind the lifecycle either.
  assert.equal(afterVerify.status, "captured");
});

test("placeholder values never displace details a later write recovers", () => {
  const withPlaceholders = apply(
    {},
    buildPaymentMerge({
      orderId: "order_1",
      paymentId: "pay_1",
      facts: razorpayFacts({
        ...capturedPayment,
        email: "void@razorpay.com",
        contact: "+919999999999",
      }),
      status: "captured",
      via: "webhook",
    }).pipeline
  );
  assert.equal(withPlaceholders.email, undefined);
  assert.equal(withPlaceholders.contact, undefined);

  // The backfill later finds the real attempt on the same order.
  const afterBackfill = apply(
    withPlaceholders,
    buildPaymentMerge({
      orderId: "order_1",
      facts: razorpayFacts(capturedPayment),
      via: "backfill",
    }).pipeline
  );
  assert.equal(afterBackfill.email, "reader@example.com");
  assert.equal(afterBackfill.contact, "+919876543210");
  assert.equal(afterBackfill.contactVia, "backfill");
});

test("contact details are read from notes and the first writer is credited", () => {
  const merged = apply(
    {},
    buildPaymentMerge({
      orderId: "order_1",
      paymentId: "pay_1",
      facts: razorpayFacts({
        id: "pay_1",
        status: "captured",
        email: "void@razorpay.com",
        notes: { email: "notes@example.com", phone: "+91 90000 10000" },
      }),
      status: "captured",
      via: "verify",
    }).pipeline
  );

  assert.equal(merged.email, "notes@example.com");
  assert.equal(merged.contact, "+919000010000");
  assert.equal(merged.contactVia, "verify");

  // A later write that also has the details does not restamp the credit.
  const again = apply(
    merged,
    buildPaymentMerge({
      orderId: "order_1",
      facts: razorpayFacts(capturedPayment),
      status: "captured",
      via: "webhook",
    }).pipeline
  );
  assert.equal(again.contactVia, "verify");
});

test("status only ever moves forward, whatever order events arrive in", () => {
  const created = { orderId: "order_1", status: "created", statusRank: 0 };

  const captured = apply(
    created,
    buildPaymentMerge({
      orderId: "order_1",
      facts: razorpayFacts(capturedPayment),
      status: "captured",
      via: "webhook",
    }).pipeline
  );
  assert.equal(captured.status, "captured");

  // Razorpay retries `payment.authorized` after the capture already landed.
  const late = apply(
    captured,
    buildPaymentMerge({
      orderId: "order_1",
      facts: razorpayFacts({ ...capturedPayment, status: "authorized" }),
      status: "authorized",
      via: "webhook",
    }).pipeline
  );
  assert.equal(late.status, "captured");
  assert.equal(late.statusRank, 4);
  assert.equal(late.capturedAt, captured.capturedAt);
});

test("a webhook-first payment creates a complete record on its own", () => {
  // The reader closed the tab, so /verify never ran and /order's intent row is
  // all we would otherwise have — here, not even that.
  const doc = apply(
    {},
    buildPaymentMerge({
      orderId: "order_1",
      paymentId: "pay_real",
      facts: razorpayFacts(capturedPayment),
      status: "captured",
      via: "webhook",
    }).pipeline
  );

  assert.equal(doc.orderId, "order_1");
  assert.equal(doc.paymentId, "pay_real");
  assert.equal(doc.email, "reader@example.com");
  assert.equal(doc.amount, 50000);
  assert.equal(doc.currency, "INR");
  assert.equal(doc.source, "webhook");
  assert.equal(doc.notified, false);
  assert.ok(doc.createdAt instanceof Date);
});

test("a real order's intent fields are never overwritten by the webhook", () => {
  // What /api/support/order wrote: the amount we actually charged, and where
  // the reader clicked support from.
  const intent = {
    orderId: "order_1",
    status: "created",
    statusRank: 0,
    amount: 50000,
    currency: "INR",
    source: "reader",
    country: "IN",
    message: "thank you for the essays",
    notified: false,
  };

  const doc = apply(
    intent,
    buildPaymentMerge({
      orderId: "order_1",
      paymentId: "pay_real",
      facts: razorpayFacts(capturedPayment),
      status: "captured",
      via: "webhook",
    }).pipeline
  );

  assert.equal(doc.source, "reader");
  assert.equal(doc.country, "IN");
  assert.equal(doc.message, "thank you for the essays");
  assert.equal(doc.amount, 50000);
  assert.equal(doc.notified, false);
});

/* ------------------------------------------------------------ PayPal ---- */

const paypalCapture = {
  id: "5O190127TN364715T",
  status: "COMPLETED",
  payer: {
    email_address: "Reader@Example.com",
    payer_id: "QYR5Z8XDVJNXQ",
    phone: { country_code: "1", phone_number: { national_number: "4155550132" } },
  },
  purchase_units: [
    {
      custom_id: "dl_abc123",
      payments: {
        captures: [
          {
            id: "3C679366HH908993F",
            status: "COMPLETED",
            amount: { currency_code: "USD", value: "5.00" },
            seller_receivable_breakdown: {
              paypal_fee: { currency_code: "USD", value: "0.64" },
            },
          },
        ],
      },
    },
  ],
};

test("a PayPal capture records the payer's email and a subunit amount", () => {
  const doc = apply(
    {},
    buildPaymentMerge({
      orderId: "5O190127TN364715T",
      facts: paypalFacts(paypalCapture),
      status: "captured",
      via: "capture",
    }).pipeline
  );

  assert.equal(doc.provider, "paypal");
  assert.equal(doc.email, "reader@example.com");
  assert.equal(doc.contact, "+14155550132");
  assert.equal(doc.method, "paypal");
  assert.equal(doc.paymentId, "3C679366HH908993F");
  // PayPal talks in "5.00"; everything downstream expects 500.
  assert.equal(doc.amountCaptured, 500);
  assert.equal(doc.currencyCaptured, "USD");
  assert.equal(doc.fee, 64);
  assert.equal(doc.status, "captured");
});

test("a later empty PayPal write cannot erase the payer's details either", () => {
  const captured = apply(
    {},
    buildPaymentMerge({
      orderId: "order_pp",
      facts: paypalFacts(paypalCapture),
      status: "captured",
      via: "capture",
    }).pipeline
  );
  // The webhook arrives after the browser already captured, but its order
  // fetch failed, so it carries nothing.
  const afterWebhook = apply(
    captured,
    buildPaymentMerge({
      orderId: "order_pp",
      facts: emptyFacts("paypal"),
      status: "captured",
      via: "webhook",
    }).pipeline
  );
  assert.equal(afterWebhook.email, "reader@example.com");
  assert.equal(afterWebhook.amountCaptured, 500);
  assert.equal(afterWebhook.provider, "paypal");
});

test("provider is stamped once and never relabelled", () => {
  const pp = apply(
    {},
    buildPaymentMerge({
      orderId: "order_pp",
      facts: paypalFacts(paypalCapture),
      status: "captured",
      via: "capture",
    }).pipeline
  );
  // A stray Razorpay-shaped write must not turn a PayPal order into a
  // Razorpay one — the admin and the backfill both key off this field.
  const confused = apply(
    pp,
    buildPaymentMerge({
      orderId: "order_pp",
      facts: razorpayFacts(capturedPayment),
      via: "webhook",
    }).pipeline
  );
  assert.equal(confused.provider, "paypal");
});

test("zero-decimal currencies convert without a phantom 100x", () => {
  assert.equal(toPaypalAmount(2000, "JPY"), "2000");
  assert.equal(toPaypalAmount(500, "USD"), "5.00");
  assert.equal(fromPaypalAmount("2000", "JPY"), 2000);
  assert.equal(fromPaypalAmount("5.00", "USD"), 500);
  // Round-trips must be lossless, or amounts drift every time they are stored.
  for (const [sub, cur] of [[500, "USD"], [2000, "JPY"], [1234, "EUR"]] as const) {
    assert.equal(fromPaypalAmount(toPaypalAmount(sub, cur), cur), sub);
  }
});

test("an unapproved PayPal order still yields the intended amount", () => {
  const pending = paypalFacts({
    id: "order_x",
    status: "PAYER_ACTION_REQUIRED",
    purchase_units: [{ amount: { currency_code: "EUR", value: "5.00" } }],
  });
  assert.equal(pending.amountSubunits, 500);
  assert.equal(pending.currency, "EUR");
  assert.equal(pending.paymentId, null);
});
