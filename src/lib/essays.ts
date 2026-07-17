import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { unstable_cache } from "next/cache";

const DB_NAME = "dailicle";
const COLLECTION = "essays";

export interface FurtherReadingItem {
  title: string;
  url: string;
}

export interface Essay {
  _id: string;
  slug?: string;
  title: string;
  hook: string;
  theme: string;
  status: "queued" | "published" | "archived";
  body?: string;
  word_count: number;
  reading_minutes: number;
  issue?: number | null;
  publish_on?: Date | null;
  published_at?: Date | null;
  created_at?: Date;
  further_reading?: FurtherReadingItem[];
  /** Relative S3 key for the narration MP3; the client prepends CloudFront. */
  audio_url?: string;
  audio_duration_seconds?: number;
  /** Readable at its URL (indexed links stay alive) but shown in no listing. */
  unlisted?: boolean;
}

/** Light projection for lists – never drags the body over the wire. */
const LIST_PROJECTION = {
  slug: 1,
  title: 1,
  hook: 1,
  theme: 1,
  status: 1,
  reading_minutes: 1,
  issue: 1,
  publish_on: 1,
  published_at: 1,
} as const;

async function collection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection(COLLECTION);
}

/** Em dash (—) → en dash (–). Every essay we serve passes through here,
 *  so this keeps em dashes out of bodies, titles, hooks, meta descriptions,
 *  and the RSS feed without touching the stored documents. */
function noEmDash(value: string): string {
  return value.replace(/—/g, "–");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(doc: any): Essay {
  const essay = { ...doc, _id: doc._id.toString() } as Essay;
  if (essay.title) essay.title = noEmDash(essay.title);
  if (essay.hook) essay.hook = noEmDash(essay.hook);
  if (essay.body) essay.body = noEmDash(essay.body);
  if (essay.further_reading) {
    essay.further_reading = essay.further_reading.map((item) => ({
      ...item,
      title: noEmDash(item.title),
    }));
  }
  return essay;
}

/** Published current-era essays, including pre-published scheduled issues. */
export async function getPublishedCandidates(limit = 20): Promise<Essay[]> {
  const col = await collection();
  const docs = await col
    .find({ status: "published", unlisted: { $ne: true } }, { projection: LIST_PROJECTION })
    .sort({ publish_on: -1, published_at: -1, created_at: -1 })
    .limit(limit)
    .toArray();
  return docs.map(serialize);
}

/** The essay currently live from the server's point of view. */
export async function getThisWeek(): Promise<Essay | null> {
  const [doc] = await getPublishedCandidates(1);
  return doc || null;
}

/**
 * Next Monday's topic – the oldest queued doc. Title and hook only;
 * a queued essay has no body and must never leak one.
 *
 * The value is identical for every reader, so it's cached across requests
 * (day-long window) instead of hitting Mongo on each /read render. It shifts
 * at most weekly, so staleness is a non-issue.
 */
export const getNextTopic = unstable_cache(
  async (): Promise<Essay | null> => {
    const [doc] = await getQueuedTopics(1);
    return doc || null;
  },
  ["next-topic"],
  { revalidate: 86400, tags: ["next-topic"] }
);

export async function getQueuedTopics(limit = 10): Promise<Essay[]> {
  const col = await collection();
  const docs = await col
    .find(
      { status: "queued" },
      { projection: { slug: 1, title: 1, hook: 1, theme: 1, status: 1 } }
    )
    .sort({ created_at: 1 })
    .limit(limit)
    .toArray();
  return docs.map(serialize);
}

/** Resolve /read/[param] – slug first, legacy ObjectId as fallback. */
export async function getEssay(param: string): Promise<Essay | null> {
  const col = await collection();

  let doc = await col.findOne({ slug: param, status: { $ne: "queued" } });
  if (!doc && ObjectId.isValid(param)) {
    doc = await col.findOne({
      _id: new ObjectId(param),
      status: { $ne: "queued" },
    });
  }
  return doc ? serialize(doc) : null;
}

/** Current-era essays, newest first. */
export async function getPublishedEssays(limit = 200): Promise<Essay[]> {
  const col = await collection();
  const docs = await col
    .find({ status: "published", unlisted: { $ne: true } }, { projection: LIST_PROJECTION })
    .sort({ publish_on: -1, published_at: -1 })
    .limit(limit)
    .toArray();
  return docs.map(serialize);
}

/**
 * The 2025 archive – legacy essays that still meet the bar, newest first.
 * Unlisted ones stay readable at their URLs but appear in no listing.
 */
export async function getArchived2025(): Promise<Essay[]> {
  const col = await collection();
  const docs = await col
    .find(
      { status: "archived", unlisted: { $ne: true } },
      { projection: LIST_PROJECTION }
    )
    .sort({ published_at: -1 })
    .toArray();
  return docs.map(serialize);
}

/** Everything listed, for the sitemap (unlisted essays are excluded). */
export async function getAllReadable(): Promise<Essay[]> {
  const col = await collection();
  const docs = await col
    .find(
      { status: { $in: ["published", "archived"] }, unlisted: { $ne: true } },
      { projection: { slug: 1, published_at: 1 } }
    )
    .sort({ published_at: -1 })
    .toArray();
  return docs.map(serialize);
}
