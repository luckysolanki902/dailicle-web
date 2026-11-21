import { PREFIXED_LOCALES } from "@/i18n/config";
import client from "@/lib/mongodb";
import { startupOpening as opening } from "@/lib/startup-opening";

export type StartupEssay = {
  _id: number;
  slug: string;
  title: string;
  dek: string;
  body: string;
};

type Translation = Pick<StartupEssay, "title" | "dek" | "body"> & { revision: string };
type StoredEssay = StartupEssay & {
  status: string;
  published_at: Date;
  approved_revision?: string;
  translations?: Record<string, Translation>;
};

async function collection() {
  return (await client).db("dailicle").collection<StoredEssay>("startup_essays");
}

const released = () => ({ status: "published", published_at: { $lte: new Date() }, _id: { $gte: 2 } });
type EssayListing = Omit<StartupEssay, "body">;

export async function startupIndex(): Promise<EssayListing[]> {
  const { _id, slug, title, dek } = opening;
  const rows = await (await collection()).find(released()).project<EssayListing>({ _id: 1, slug: 1, title: 1, dek: 1 }).sort({ _id: -1 }).toArray();
  return [...rows, { _id, slug, title, dek }];
}

export async function startupListing(slug: string, locale = "en"): Promise<(EssayListing & { locales: string[] }) | null> {
  if (slug === opening.slug) return { _id: opening._id, slug, title: opening.title, dek: opening.dek, locales: ["en"] };
  const projection: Record<string, 1> = { _id: 1, slug: 1, title: 1, dek: 1, approved_revision: 1 };
  for (const code of PREFIXED_LOCALES) projection[`translations.${code}.revision`] = 1;
  if (PREFIXED_LOCALES.includes(locale)) {
    projection[`translations.${locale}.title`] = 1;
    projection[`translations.${locale}.dek`] = 1;
  }
  const row = await (await collection()).findOne({ ...released(), slug }, { projection });
  if (!row) return null;
  const locales = ["en", ...PREFIXED_LOCALES.filter((code) =>
    row.approved_revision && row.translations?.[code]?.revision === row.approved_revision)];
  const translated = locales.includes(locale) ? row.translations?.[locale] : undefined;
  return { _id: row._id, slug, locales, title: translated?.title ?? row.title, dek: translated?.dek ?? row.dek };
}

export async function startupBody(slug: string, member: boolean, locale = "en"): Promise<string | null> {
  if (slug === opening.slug) return opening.body;
  if (!member) return null;
  if (locale === "en") {
    const row = await (await collection()).findOne({ ...released(), slug }, { projection: { body: 1 } });
    return row?.body ?? null;
  }
  if (!PREFIXED_LOCALES.includes(locale)) return null;
  const row = await (await collection()).findOne({ ...released(), slug }, {
    projection: { approved_revision: 1, [`translations.${locale}`]: 1 },
  });
  const translated = row?.translations?.[locale];
  return translated && row?.approved_revision === translated.revision ? translated.body : null;
}

export async function hasPublishedMembersEssay() {
  return Boolean(await (await collection()).findOne(released(), { projection: { _id: 1 } }));
}
