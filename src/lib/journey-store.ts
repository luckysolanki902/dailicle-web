import clientPromise from "@/lib/mongodb";
import type { Collection, Db, Document } from "mongodb";

/**
 * Server-side home of the reader journey (see `lib/journey.ts` for the client
 * half). Three collections, each shaped for the question it answers:
 *
 *  - `reader_journeys`   one doc per anonymous visitor: entry point, totals,
 *                        whether they ever supported. The spine.
 *  - `reader_page_time`  one doc per visitor+page: accumulated *active* reading
 *                        seconds, views, deepest scroll. Answers "how long on
 *                        which essay" with cheap `$inc`/`$max` upserts instead
 *                        of an ever-growing array inside the visitor doc.
 *  - `reader_events`     the ordered timeline, so the admin can replay the path
 *                        that ended in a payment.
 *
 * Nothing here stores anything the reader typed or that identifies them; the
 * visitor id is a random value their own browser minted.
 */

/** Milestones we keep on the timeline, plus the per-page dwell record. */
export const JOURNEY_EVENT_TYPES = [
  "page",
  "support_open",
  "checkout_start",
  "checkout_dismiss",
  "payment_success",
  "subscribe",
] as const;

export type JourneyEventType = (typeof JOURNEY_EVENT_TYPES)[number];

let indexed: Promise<void> | null = null;

async function ensureIndexes(db: Db): Promise<void> {
  indexed ??= (async () => {
    await Promise.all([
      db.collection("reader_journeys").createIndex({ vid: 1 }, { unique: true }),
      db.collection("reader_journeys").createIndex({ lastSeenAt: -1 }),
      db
        .collection("reader_page_time")
        .createIndex({ vid: 1, key: 1 }, { unique: true }),
      db.collection("reader_page_time").createIndex({ essayId: 1 }),
      db.collection("reader_events").createIndex({ vid: 1, at: 1 }),
    ]);
  })().catch((err) => {
    // A failed index build must not wedge every later write; retry next time.
    indexed = null;
    throw err;
  });
  return indexed;
}

export async function journeyDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db("dailicle");
  await ensureIndexes(db);
  return db;
}

export async function journeysCollection(): Promise<Collection<Document>> {
  return (await journeyDb()).collection("reader_journeys");
}

/**
 * Mark a visitor as having supported, and stamp the moment. Called from the
 * payment path, where a failure must never break the payment — hence the
 * swallowed error.
 */
export async function markJourneySupported(
  vid: string | null | undefined,
  at: Date
): Promise<void> {
  if (!vid) return;
  try {
    const db = await journeyDb();
    await db.collection("reader_journeys").updateOne(
      { vid },
      {
        $set: { supported: true, lastSupportAt: at },
        $min: { firstSupportAt: at },
        $inc: { supportCount: 1 },
      },
      // Upsert so a payment is never lost just because the tracking beacon was
      // blocked — an otherwise-empty journey still records that they gave.
      { upsert: true }
    );
    await db.collection("reader_events").insertOne({
      vid,
      type: "payment_verified",
      at,
      path: null,
    });
  } catch (err) {
    console.error("markJourneySupported failed:", err);
  }
}
