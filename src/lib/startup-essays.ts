import { PREFIXED_LOCALES } from "@/i18n/config";
import client from "@/lib/mongodb";

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
  is_free?: boolean;
  approved_revision?: string;
  translations?: Record<string, Translation>;
};

async function collection() {
  return (await client).db("dailicle").collection<StoredEssay>("startup_essays");
}

const released = () => ({ status: "published", published_at: { $lte: new Date() }, _id: { $gte: 2 } });
type EssayListing = Omit<StartupEssay, "body"> & { published_at: Date; is_free?: boolean };

const listingFields = { _id: 1, slug: 1, title: 1, dek: 1, published_at: 1, is_free: 1 } as const;

export async function startupIndex(): Promise<EssayListing[]> {
  return (await collection()).find(released()).project<EssayListing>(listingFields).sort({ published_at: -1 }).toArray();
}

export async function startupOpeningEssay(): Promise<EssayListing | null> {
  return (await collection()).findOne<EssayListing>({ ...released(), is_free: true }, { projection: listingFields, sort: { published_at: -1 } });
}

export async function startupListing(slug: string, locale = "en"): Promise<(EssayListing & { locales: string[] }) | null> {
  const projection: Record<string, 1> = { ...listingFields, approved_revision: 1 };
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
  return { _id: row._id, slug, locales, published_at: row.published_at, is_free: row.is_free, title: translated?.title ?? row.title, dek: translated?.dek ?? row.dek };
}

export async function startupBody(slug: string, member: boolean, locale = "en"): Promise<string | null> {
  const visible = { ...released(), slug, ...(member ? {} : { is_free: true }) };
  if (locale === "en") {
    const row = await (await collection()).findOne(visible, { projection: { body: 1 } });
    return row?.body ?? null;
  }
  if (!PREFIXED_LOCALES.includes(locale)) return null;
  const row = await (await collection()).findOne(visible, {
    projection: { approved_revision: 1, [`translations.${locale}`]: 1 },
  });
  const translated = row?.translations?.[locale];
  return translated && row?.approved_revision === translated.revision ? translated.body : null;
}

export async function hasPublishedMembersEssay() {
  return Boolean(await (await collection()).findOne({ ...released(), is_free: { $ne: true } }, { projection: { _id: 1 } }));
}
