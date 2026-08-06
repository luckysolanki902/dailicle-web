import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentMerge } from "./supporter-merge";
import { normalizeContact, normalizeEmail } from "./razorpay";

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
      payment: capturedPayment,
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
      payment: {},
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
      payment: {
        ...capturedPayment,
        email: "void@razorpay.com",
        contact: "+919999999999",
      },
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
      payment: capturedPayment,
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
      payment: {
        id: "pay_1",
        status: "captured",
        email: "void@razorpay.com",
        notes: { email: "notes@example.com", phone: "+91 90000 10000" },
      },
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
      payment: capturedPayment,
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
      payment: capturedPayment,
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
      payment: { ...capturedPayment, status: "authorized" },
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
      payment: capturedPayment,
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
      payment: capturedPayment,
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
