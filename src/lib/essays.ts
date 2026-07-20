import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { unstable_cache } from "next/cache";

const DB_NAME = "dailicle";
const COLLECTION = "essays";
/** One document per (essay, language); written by the server pipeline. */
const TRANSLATIONS = "essay_translations";

export interface FurtherReadingItem {
  title: string;
  url: string;
}

export interface BannerImage {
  id: string;
  /** Relative S3 key, e.g. dailicle/banners/<essayId>/<uuid>.png. */
  key: string;
  prompt?: string | null;
  model?: string | null;
  width?: number;
  height?: number;
  created_at?: Date;
  /** PNG has a transparent background → render the subject directly on the page. */
  transparent?: boolean;
}

/** CDN origin for banner images (CloudFront). Server-side only. */
const CDN_BASE = (process.env.CDN_BASE_URL || "").replace(/\/+$/, "");

/** Absolute CDN URL for a stored banner key, or null if CDN is unconfigured. */
export function bannerImageUrl(key: string | undefined | null): string | null {
  if (!key || !CDN_BASE) return null;
  return `${CDN_BASE}/${key.replace(/^\/+/, "")}`;
}

/**
 * The banner URL to show for an essay: the enabled + selected image, falling
 * back to the first available image. Returns null when banners are off or none
 * exist, so callers render the plain (bannerless) layout unchanged.
 */
interface HasBanner {
  banner_enabled?: boolean;
  banner_image_id?: string | null;
  banner_images?: BannerImage[];
}

function chosenBanner(essay: HasBanner): BannerImage | null {
  if (!essay.banner_enabled) return null;
  const images = essay.banner_images || [];
  if (images.length === 0) return null;
  return images.find((i) => i.id === essay.banner_image_id) || images[0];
}

export function essayBannerUrl(essay: HasBanner): string | null {
  return bannerImageUrl(chosenBanner(essay)?.key);
}

/** URL plus whether the image has a transparent background (render flat on page). */
export function essayBannerInfo(
  essay: HasBanner
): { url: string; transparent: boolean } | null {
  const chosen = chosenBanner(essay);
  const url = bannerImageUrl(chosen?.key);
  if (!url) return null;
  return { url, transparent: !!chosen?.transparent };
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
  /** Editorial banner illustration (opt-in per essay). */
  banner_enabled?: boolean;
  banner_image_id?: string | null;
  banner_images?: BannerImage[];
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
  banner_enabled: 1,
  banner_image_id: 1,
  banner_images: 1,
} as const;

async function collection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection(COLLECTION);
}

/** Em dash → en dash. Every essay we serve passes through here,
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
 * Two essays to hard-recommend at the end of the one just read:
 *   1. the latest from the *same* category ("more like this"), then
 *   2. the latest from a *different* category ("something new"),
 * both newest-first, excluding the current essay and any not-yet-released
 * (future-dated) issue. If a bucket is empty (e.g. only one category exists so
 * far) the slot is filled with the newest remaining essay so there are always
 * two. This is the internal-linking lever that turns a one-essay visit into a
 * second read.
 */
export async function getRelatedEssays(
  currentId: string,
  theme: string | undefined,
  limit = 2
): Promise<Essay[]> {
  const col = await collection();
  const base: Record<string, unknown> = {
    status: { $in: ["published", "archived"] },
    unlisted: { $ne: true },
    published_at: { $lte: new Date() },
  };

  const picked: Essay[] = [];
  const seen = new Set<string>([currentId]);

  const takeLatest = async (query: Record<string, unknown>) => {
    if (picked.length >= limit) return;
    const exclude = [...seen]
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    const doc = await col.findOne(
      { ...query, _id: { $nin: exclude } },
      { projection: LIST_PROJECTION, sort: { publish_on: -1, published_at: -1 } }
    );
    if (doc) {
      const e = serialize(doc);
      seen.add(e._id);
      picked.push(e);
    }
  };

  if (theme) await takeLatest({ ...base, theme }); // 1) same category, latest
  await takeLatest(theme ? { ...base, theme: { $ne: theme } } : base); // 2) different, latest
  while (picked.length < limit) {
    const before = picked.length;
    await takeLatest(base); // fill any empty slot with the newest remaining
    if (picked.length === before) break; // nothing left to add
  }
  return picked.slice(0, limit);
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

// ------------------------------------------------------------ translations

export interface EssayTranslation {
  essayId: string;
  lang: string;
  title: string;
  hook: string;
  body: string;
  meta_description: string;
}

async function translationsCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection(TRANSLATIONS);
}

const TRANSLATION_PROJECTION = {
  essayId: 1,
  lang: 1,
  title: 1,
  hook: 1,
  body: 1,
  meta_description: 1,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeTranslation(doc: any): EssayTranslation {
  return {
    essayId: doc.essayId,
    lang: doc.lang,
    title: doc.title ? noEmDash(doc.title) : "",
    hook: doc.hook ? noEmDash(doc.hook) : "",
    body: doc.body ? noEmDash(doc.body) : "",
    meta_description: doc.meta_description ? noEmDash(doc.meta_description) : "",
  };
}

/** One essay's translation for a language, or null (caller falls back to English). */
export async function getEssayTranslation(
  essayId: string,
  lang: string
): Promise<EssayTranslation | null> {
  if (lang === "en") return null;
  const col = await translationsCollection();
  const doc = await col.findOne(
    { essayId, lang },
    { projection: TRANSLATION_PROJECTION }
  );
  return doc ? serializeTranslation(doc) : null;
}

/** Translations for many essays at once (lists) → map keyed by essayId. */
export async function getTranslationsMap(
  essayIds: string[],
  lang: string
): Promise<Map<string, EssayTranslation>> {
  const map = new Map<string, EssayTranslation>();
  if (lang === "en" || essayIds.length === 0) return map;
  const col = await translationsCollection();
  const docs = await col
    .find({ essayId: { $in: essayIds }, lang }, { projection: TRANSLATION_PROJECTION })
    .toArray();
  for (const doc of docs) {
    const t = serializeTranslation(doc);
    map.set(t.essayId, t);
  }
  return map;
}

/**
 * Overlay a translation onto an English essay. Title/hook/body switch to the
 * translated text; everything else (slug, dates, banner, audio) stays. When the
 * translation is null (missing or English), the essay is returned untouched, so
 * the site always degrades gracefully to English.
 */
export function localizeEssay(
  essay: Essay,
  translation: EssayTranslation | null
): Essay {
  if (!translation) return essay;
  return {
    ...essay,
    title: translation.title || essay.title,
    hook: translation.hook || essay.hook,
    body: translation.body || essay.body,
  };
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
