// Relative import (not the "@/" alias) so this module and its test compile
// standalone under `npm run test:merge`, the same way release.ts does.
import { contactFromPayment, type PaymentContact } from "./razorpay";

/**
 * How a Razorpay payment gets merged onto a supporter record.
 *
 * Kept as a pure function, separate from the Mongo/mailer plumbing in
 * `supporters.ts`, because this is the part that has to be exactly right: three
 * independent writers (the browser's /verify call, Razorpay's webhook, and the
 * contact backfill) all update the same document, in any order, sometimes at the
 * same instant, and each of them may hold only part of the truth.
 *
 * Two rules govern everything below:
 *
 *  1. Never overwrite something with nothing. Contact details, method, fees —
 *     each is written only when this particular write actually carries a value.
 *     The original bug was /verify unconditionally setting email/contact to null
 *     when its payment fetch failed, erasing what the webhook had just stored.
 *  2. Status only moves forward. Webhooks arrive out of order and get retried,
 *     so a late `payment.authorized` must not demote a captured payment.
 *
 * The result is expressed as a Mongo aggregation-pipeline update so the whole
 * compare-and-merge happens atomically inside the database, rather than as a
 * read-then-write in Node that a concurrent writer could interleave with.
 */

/** Lifecycle positions, lowest to highest. Status may only ever increase. */
export const STATUS_RANK: Record<string, number> = {
  created: 0,
  failed: 1,
  authorized: 2,
  paid: 3,
  captured: 4,
};

export type PaymentStatus = "authorized" | "paid" | "captured" | "failed";

export interface MergeInput {
  orderId: string;
  paymentId?: string | null;
  /** The Razorpay payment entity, or `{}`/null if we could not fetch it. */
  payment?: Record<string, unknown> | null;
  /** New lifecycle status; ignored if it would move the record backwards. */
  status?: PaymentStatus;
  /** Which writer this is ("verify", "webhook", "backfill"). */
  via: string;
}

/**
 * Mongo expression for "use `value` if this write has one, else keep what is
 * already stored". A literal wrapper is required because a bare string that
 * happens to start with `$` would be read as a field path, not a value.
 */
function preferNew(value: unknown, field: string): unknown {
  return value === null || value === undefined
    ? `$${field}`
    : { $literal: value };
}

/** Keep the stored value if there is one, otherwise take this write's. */
function fillIfEmpty(value: unknown, field: string): unknown {
  return { $ifNull: [`$${field}`, preferNew(value, field)] };
}

export interface MergeResult {
  /** The aggregation pipeline to hand to updateOne/findOneAndUpdate. */
  pipeline: Record<string, unknown>[];
  /** What this write learned about the reader, after normalization. */
  contact: PaymentContact;
}

export function buildPaymentMerge(
  input: MergeInput,
  now: Date = new Date()
): MergeResult {
  const payment = input.payment ?? {};
  const hasEntity = Object.keys(payment).length > 0;
  const contact = contactFromPayment(payment);
  const learnedContact = Boolean(contact.email || contact.contact);

  const rank = input.status ? STATUS_RANK[input.status] : undefined;
  const captured = input.status === "captured" || input.status === "paid";
  const currentRank = { $ifNull: ["$statusRank", -1] };

  const set: Record<string, unknown> = {
    orderId: input.orderId,
    createdAt: { $ifNull: ["$createdAt", now] },
    notified: { $ifNull: ["$notified", false] },
    updatedAt: now,

    paymentId: preferNew(input.paymentId, "paymentId"),

    // Rule 1, the whole point of this module: once we know how to reach a
    // supporter, no later write may blank it out.
    email: preferNew(contact.email, "email"),
    contact: preferNew(contact.contact, "contact"),
    // Which writer first learned the details — for auditing gaps later.
    contactVia: learnedContact ? { $ifNull: ["$contactVia", input.via] } : "$contactVia",
    contactAt: learnedContact ? { $ifNull: ["$contactAt", now] } : "$contactAt",

    method: preferNew(payment.method, "method"),
    fee: preferNew(payment.fee, "fee"),
    tax: preferNew(payment.tax, "tax"),
    amountCaptured: preferNew(payment.amount, "amountCaptured"),
    currencyCaptured: preferNew(payment.currency, "currencyCaptured"),
    // The raw entity is worth keeping, but only when we have a real one.
    razorpay: hasEntity ? { $literal: payment } : "$razorpay",
    capturedAt: captured ? { $ifNull: ["$capturedAt", now] } : "$capturedAt",

    // Intent fields normally come from /api/support/order. Fill them only if
    // this is the first we have heard of the order at all — which happens when
    // the reader closed the tab and the webhook got here first.
    amount: fillIfEmpty(payment.amount, "amount"),
    currency: fillIfEmpty(payment.currency, "currency"),
    source: { $ifNull: ["$source", input.via] },
  };

  // Rule 2: advance the lifecycle, never rewind it.
  if (rank !== undefined) {
    set.status = {
      $cond: [{ $gt: [rank, currentRank] }, input.status, "$status"],
    };
    set.statusRank = { $max: [rank, currentRank] };
  }

  return { pipeline: [{ $set: set }], contact };
}
