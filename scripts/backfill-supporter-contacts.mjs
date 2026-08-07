// Reconcile supporter records against Razorpay, and recover missing contacts.
//
// Two passes, because payments went missing in two different ways:
//
//  1. Reconcile — every payment Razorpay knows about that has no supporter
//     record at all. A payment could be captured while our record stayed at
//     "created": /verify's update was not an upsert, so if the order row was
//     missing it silently wrote nothing, and any webhook that failed signature
//     verification left no trace either.
//  2. Backfill — records that exist but have no usable contact details, because
//     the old code nulled email/contact whenever the payment fetch failed, and
//     stored Razorpay's placeholders (void@razorpay.com, +919999999999) as if
//     they were real.
//
//   node scripts/backfill-supporter-contacts.mjs           # dry run
//   node scripts/backfill-supporter-contacts.mjs --write    # actually update
//   node scripts/backfill-supporter-contacts.mjs --days=365 # lookback window
//
// Idempotent and non-destructive: it only ever fills what is empty.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes("--write");
const DAYS = Number(
  process.argv.find((a) => a.startsWith("--days="))?.slice(7) || 365
);

/**
 * Payments that are real on the gateway but are not real supporters — our own
 * test transactions. The reconcile pass exists precisely to resurrect payments
 * missing from Mongo, so deleting one of these by hand does not stick: the next
 * run finds it on Razorpay again and puts it straight back. They have to be
 * named here to stay deleted.
 *
 * Add the order id, not the payment id — reconcile keys off the order.
 */
const IGNORED_ORDER_IDS = new Set([
  // ₹99 UPI, 2026-07-17 — the owner's own test of the live Razorpay checkout.
  "order_TEf2iz2STeKcnD",
  ...(process.env.SUPPORT_IGNORE_ORDERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]);

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

// Kept in sync with src/lib/razorpay.ts — see the comments there for why these
// placeholder values have to be treated as "no contact details at all".
const PLACEHOLDER_CONTACTS = new Set([
  "+919999999999",
  "919999999999",
  "9999999999",
  "+910000000000",
  "0000000000",
]);

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email === "void" || email.endsWith("@razorpay.com")) return null;
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 254);
}

function normalizeContact(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.toLowerCase() === "void") return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  const normalized = (plus ? "+" : "") + digits;
  if (PLACEHOLDER_CONTACTS.has(normalized) || PLACEHOLDER_CONTACTS.has(digits)) {
    return null;
  }
  if (/^(\d)\1+$/.test(digits)) return null;
  return normalized;
}

function contactFromPayment(payment) {
  const notes = payment?.notes ?? {};
  return {
    email:
      normalizeEmail(payment?.email) ??
      normalizeEmail(notes.email) ??
      normalizeEmail(notes.customer_email),
    contact:
      normalizeContact(payment?.contact) ??
      normalizeContact(notes.contact) ??
      normalizeContact(notes.phone) ??
      normalizeContact(notes.customer_contact),
  };
}

function score(payment) {
  const s = String(payment?.status || "");
  return { captured: 4, refunded: 3, authorized: 2, created: 1 }[s] ?? 0;
}

async function razorpayGet(path) {
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db("dailicle").collection("supporters");

  if (!WRITE) console.log("(dry run — pass --write to apply)\n");

  // ── Pass 1: payments Razorpay has that we have no record of at all ────────
  const from = Math.floor(Date.now() / 1000) - DAYS * 86400;
  const all = await razorpayGet(`/payments?count=100&from=${from}`);
  const payments = (all.items ?? []).filter((p) =>
    ["captured", "authorized", "refunded"].includes(p.status)
  );
  console.log(`${payments.length} real payment(s) on Razorpay in the last ${DAYS}d`);

  let recovered = 0;
  for (const p of payments) {
    if (!p.order_id) continue;
    if (IGNORED_ORDER_IDS.has(p.order_id)) {
      console.log(`  – ${p.order_id} skipped (listed as a test payment)`);
      continue;
    }
    const doc = await col.findOne({ orderId: p.order_id });
    // Already reconciled if we know the payment and its lifecycle moved past
    // "created" (i.e. something other than /api/support/order wrote to it).
    if (doc?.paymentId === p.id && doc?.status && doc.status !== "created") {
      continue;
    }

    const found = contactFromPayment(p);
    recovered++;
    console.log(
      `  ✓ ${p.order_id} ${p.id} ${p.status} ${p.amount / 100} ${p.currency}` +
        ` → ${found.email || "-"} / ${found.contact || "-"}` +
        (doc ? " (record was stuck at 'created')" : " (no record at all)")
    );
    if (!WRITE) continue;

    const status = p.status === "captured" ? "captured" : "authorized";
    const set = {
      orderId: p.order_id,
      paymentId: p.id,
      status,
      statusRank: status === "captured" ? 4 : 2,
      method: p.method ?? null,
      fee: p.fee ?? null,
      tax: p.tax ?? null,
      amountCaptured: p.amount ?? null,
      currencyCaptured: p.currency ?? null,
      razorpay: p,
      capturedAt: doc?.capturedAt ?? new Date(p.created_at * 1000),
      updatedAt: new Date(),
      // Only fill contact fields we do not already have something real for.
      ...(found.email && !normalizeEmail(doc?.email) ? { email: found.email } : {}),
      ...(found.contact && !normalizeContact(doc?.contact)
        ? { contact: found.contact }
        : {}),
      ...(found.email || found.contact
        ? { contactVia: doc?.contactVia || "reconcile", contactAt: doc?.contactAt || new Date() }
        : {}),
    };
    await col.updateOne(
      { orderId: p.order_id },
      {
        $set: set,
        $setOnInsert: {
          createdAt: new Date(p.created_at * 1000),
          notified: true, // historic payment — do not email the owner about it
          amount: p.amount ?? null,
          currency: p.currency ?? null,
          country: p.notes?.country ?? null,
          source: p.notes?.source ?? "reconcile",
          tier: p.notes?.tier ?? null,
        },
      },
      { upsert: true }
    );
  }
  console.log(`${recovered} payment(s) ${WRITE ? "reconciled" : "to reconcile"}\n`);

  // ── Pass 2: records that exist but have no usable contact details ─────────
  // Anything that got as far as a payment but has no usable contact details —
  // including rows holding Razorpay's placeholders, which are not details.
  const docs = await col
    .find({
      status: { $in: ["paid", "captured", "authorized", "failed"] },
      $or: [
        { email: { $in: [null, ""] } },
        { email: { $exists: false } },
        { email: { $regex: "@razorpay\\.com$", $options: "i" } },
        { contact: { $in: [null, "", ...PLACEHOLDER_CONTACTS] } },
        { contact: { $exists: false } },
      ],
    })
    .toArray();

  console.log(`${docs.length} supporter record(s) missing contact details`);

  let filled = 0;
  for (const doc of docs) {
    if (IGNORED_ORDER_IDS.has(doc.orderId)) continue;
    let attempts = [];
    try {
      const body = await razorpayGet(`/orders/${doc.orderId}/payments`);
      attempts = Array.isArray(body.items) ? body.items : [];
    } catch (err) {
      console.warn(`  ! ${doc.orderId}: ${err.message}`);
      continue;
    }
    if (!attempts.length) continue;

    // Take contact details from any attempt on the order, best-ranked first.
    attempts.sort((a, b) => score(b) - score(a));
    let email = normalizeEmail(doc.email);
    let contact = normalizeContact(doc.contact);
    for (const attempt of attempts) {
      const found = contactFromPayment(attempt);
      email ||= found.email;
      contact ||= found.contact;
    }

    const update = {};
    if (email !== normalizeEmail(doc.email)) update.email = email ?? null;
    if (contact !== normalizeContact(doc.contact)) update.contact = contact ?? null;
    // Scrub a stored placeholder even when Razorpay has nothing better to give.
    if (doc.email && !normalizeEmail(doc.email) && !email) update.email = null;
    if (doc.contact && !normalizeContact(doc.contact) && !contact) {
      update.contact = null;
    }
    if (!Object.keys(update).length) continue;

    filled++;
    console.log(
      `  ✓ ${doc.orderId} → ${update.email || "-"} / ${update.contact || "-"}`
    );
    if (WRITE) {
      update.contactVia = doc.contactVia || "backfill-script";
      update.contactAt = doc.contactAt || new Date();
      await col.updateOne({ _id: doc._id }, { $set: update });
    }
  }

  console.log(`${filled} record(s) ${WRITE ? "updated" : "recoverable"}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
