import { ArchiveList, ArchiveEntry } from "@/components/archive/ArchiveList";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import {
  getPublishedEssays,
  getArchived2025,
  getTranslationsMap,
  essayBannerUrl,
  Essay,
  EssayTranslation,
} from "@/lib/essays";
import { formatDate } from "@/lib/utils";
import { isReleasedLocally } from "@/lib/release";
import { getLikeCounts } from "@/lib/reactions";
import { DEFAULT_SORT, sortEntries } from "@/lib/archive-sort";
import { getTranslations } from "@/i18n/getMessages";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  localeUrl,
  hreflangAlternates,
  type Locale,
} from "@/i18n/config";
import type { Metadata } from "next";

// Match the homepage cadence: a new essay ships weekly, but the essay is
// written to the DB out-of-band (the publish cron), so a day-long window left
// the archive showing the previous week on publish day. Hourly revalidation
// keeps it fresh within an hour of a publish, same as the homepage.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const { t } = await getTranslations(locale);
  const title = t("archive.meta.title");
  const description = t("archive.meta.description");

  return {
    title,
    description,
    keywords: [
      "essay archive",
      "philosophy essays",
      "psychology essays",
      "weekly essays",
      "long-form reading",
      "thoughtful writing",
    ],
    publisher: "The Dailicle",
    openGraph: {
      title,
      description,
      url: localeUrl("/archive", locale),
      siteName: "The Dailicle",
      locale: LOCALES[locale].ogLocale,
      type: "website",
      images: [
        {
          url: "https://dailicle.com/og-archive.png",
          width: 1200,
          height: 630,
          alt: "The Dailicle Archive",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@dailicle",
      title,
      description,
      images: { url: "https://dailicle.com/og-archive.png", alt: "The Dailicle Archive" },
    },
    alternates: {
      canonical: localeUrl("/archive", locale),
      languages: hreflangAlternates("/archive"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

function toEntry(
  essay: Essay,
  now: Date,
  translation: EssayTranslation | undefined,
  likes: number
): ArchiveEntry {
  return {
    href: `/read/${essay.slug || essay._id}`,
    title: translation?.title || essay.title,
    hook: translation?.hook || essay.hook,
    theme: essay.theme,
    readingMinutes: essay.reading_minutes,
    dateLabel: formatDate(essay.published_at, "medium"),
    publishOn: essay.publish_on ? new Date(essay.publish_on).toISOString() : null,
    publishedAt: essay.published_at ? new Date(essay.published_at).toISOString() : null,
    issue: essay.issue,
    likes,
    bannerUrl: essayBannerUrl(essay),
    initialReleased: isReleasedLocally(
      { publish_on: essay.publish_on, published_at: essay.published_at },
      now
    ),
  };
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;

  const [published, archived, likes] = await Promise.all([
    getPublishedEssays(),
    getArchived2025(),
    getLikeCounts(),
  ]);

  const translations = await getTranslationsMap(
    [...published, ...archived].map((e) => e._id),
    locale
  );
  const { t } = await getTranslations(locale);
  const now = new Date();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "The Dailicle Archive",
    description: t("archive.meta.description"),
    url: localeUrl("/archive", locale),
    inLanguage: LOCALES[locale].htmlLang,
    publisher: {
      "@type": "Organization",
      name: "The Dailicle",
    },
    hasPart: [...published, ...archived].map((essay) => ({
      "@type": "Article",
      headline: translations.get(essay._id)?.title || essay.title,
      datePublished: formatDate(essay.published_at, "iso"),
      url: localeUrl(`/read/${essay.slug || essay._id}`, locale),
      author: {
        "@type": "Organization",
        name: "The Dailicle",
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />
        <ArchiveList
          // Pre-sorted into the default order so the first paint already
          // matches what the client renders after hydration.
          current={sortEntries(
            published.map((essay) =>
              toEntry(essay, now, translations.get(essay._id), likes[essay._id] ?? 0)
            ),
            DEFAULT_SORT
          )}
          // The 2025 archive keeps its own newest-first order: it sits apart
          // from the catalogue, and its essays predate reactions entirely.
          legacy={archived.map((essay) =>
            toEntry(essay, now, translations.get(essay._id), likes[essay._id] ?? 0)
          )}
        />
      </main>
    </>
  );
}
