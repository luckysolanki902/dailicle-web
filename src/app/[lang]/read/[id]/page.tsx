import { EssayReader } from "@/components/reader/EssayReader";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import {
  getEssay,
  getEssayTranslation,
  getTranslationsMap,
  localizeEssay,
  getRelatedEssays,
  getAllReadable,
  essayBannerUrl,
  essayBannerInfo,
} from "@/lib/essays";
import { themeLabel } from "@/lib/themes";
import { getTranslations } from "@/i18n/getMessages";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  localeUrl,
  hreflangAlternates,
  type Locale,
} from "@/i18n/config";
import { formatDate } from "@/lib/utils";
import { isReleasedEverywhere } from "@/lib/release";
import { essayExcerpt, META_DESCRIPTION_LIMIT } from "@/lib/excerpt";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Essays change at most weekly, so there's no reason to revalidate hourly.
// A day-long window keeps background regeneration (and its CPU) ~24x lower;
// the admin can still force an update via on-demand revalidation.
export const revalidate = 86400;

/**
 * Prebuild every listed essay in English so the hottest route serves from the
 * CDN. Localized variants (dynamicParams stays on, the default) render on first
 * request and then cache via ISR — this keeps the build from fanning out to
 * essays × 10 locales while still serving every language from the edge.
 */
export async function generateStaticParams() {
  const essays = await getAllReadable();
  return essays
    .filter((essay) => essay.slug)
    .map((essay) => ({ lang: DEFAULT_LOCALE, id: essay.slug as string }));
}

/** Localized theme label ("Psychology" → "Psychologie"), English fallback. */
async function localeThemeLabel(theme: string | undefined, locale: Locale): Promise<string> {
  const { t } = await getTranslations(locale);
  const key = `themes.${theme}`;
  const translated = t(key);
  return translated === key ? themeLabel(theme) : translated;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const essay = await getEssay(id);

  if (!essay) {
    return {
      title: "Essay Not Found - The Dailicle",
      description: "The requested essay could not be found.",
    };
  }

  const translation = await getEssayTranslation(essay._id, locale);
  const localized = localizeEssay(essay, translation);
  const slug = essay.slug || essay._id;
  const path = `/read/${slug}`;
  const releasedEverywhere = isReleasedEverywhere({
    publish_on: essay.publish_on,
    published_at: essay.published_at,
  });

  // Prefer the essay's own opening words: a SERP snippet should show what the
  // piece actually says, not the hook, which is teaser copy and reads as thin
  // boilerplate once it is sitting under a search result. Gated on the essay
  // being out everywhere for the same reason the body is — before that the
  // page shows a placeholder, and the description must not leak past it.
  // A translator-written meta_description still wins where one exists; it is
  // deliberate per-locale copy, and only translations carry the field.
  const description = (
    translation?.meta_description ||
    (releasedEverywhere ? essayExcerpt(localized.body) : "") ||
    localized.hook ||
    `An essay from The Dailicle. A ${essay.reading_minutes}-minute read.`
  ).slice(0, META_DESCRIPTION_LIMIT);

  const categoryLabel = await localeThemeLabel(essay.theme, locale);

  // Prefer the essay's own banner illustration (it carries no text, so it works
  // for every language); fall back to the dynamic OG card with the translated
  // title otherwise.
  const banner = essayBannerUrl(essay);
  const ogImageUrl = new URL("https://dailicle.com/api/og");
  ogImageUrl.searchParams.set("title", localized.title);
  ogImageUrl.searchParams.set("category", categoryLabel);
  ogImageUrl.searchParams.set("minimal", "true");

  const ogImage = banner
    ? { url: banner, width: 2560, height: 1024, alt: localized.title, type: "image/png" }
    : {
        url: ogImageUrl.toString(),
        width: 1200,
        height: 630,
        alt: localized.title,
        type: "image/png",
      };

  return {
    title: `${localized.title} - The Dailicle`,
    description,
    keywords: [
      categoryLabel,
      "essay",
      "weekly essay",
      "long-form writing",
      "thoughtful reading",
    ],
    authors: [{ name: "The Dailicle Desk", url: "https://dailicle.com" }],
    publisher: "The Dailicle",
    openGraph: {
      title: `${localized.title} | The Dailicle`,
      description,
      url: localeUrl(path, locale),
      siteName: "The Dailicle",
      locale: LOCALES[locale].ogLocale,
      type: "article",
      publishedTime: formatDate(essay.published_at, "iso"),
      authors: ["The Dailicle Desk"],
      section: categoryLabel,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      site: "@dailicle",
      title: `${localized.title} | The Dailicle`,
      description,
      images: { url: ogImage.url, alt: localized.title },
    },
    alternates: {
      canonical: localeUrl(path, locale),
      languages: hreflangAlternates(path),
    },
  };
}

export default async function ReadPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const essay = await getEssay(id);

  if (!essay || !essay.body) {
    notFound();
  }

  const translation = await getEssayTranslation(essay._id, locale);
  const localized = localizeEssay(essay, translation);
  const slug = essay.slug || essay._id;
  const categoryLabel = await localeThemeLabel(essay.theme, locale);

  // Two hard recommendations for the end of the essay, localized.
  const related = await getRelatedEssays(essay._id, essay.theme, 2);
  const relatedTranslations = await getTranslationsMap(
    related.map((r) => r._id),
    locale
  );
  const relatedProps = await Promise.all(
    related.map(async (r) => {
      const tr = relatedTranslations.get(r._id);
      return {
        href: `/read/${r.slug || r._id}`,
        title: tr?.title || r.title,
        hook: tr?.hook || r.hook,
        themeLabel: await localeThemeLabel(r.theme, locale),
        readingMinutes: r.reading_minutes,
      };
    })
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: localized.title,
    description: localized.hook,
    author: {
      "@type": "Organization",
      name: "The Dailicle",
      url: "https://dailicle.com",
    },
    publisher: {
      "@type": "Organization",
      name: "The Dailicle",
      url: "https://dailicle.com",
      logo: {
        "@type": "ImageObject",
        url: "https://dailicle.com/logo.png",
      },
    },
    datePublished: formatDate(essay.published_at, "iso"),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": localeUrl(`/read/${slug}`, locale),
    },
    articleSection: categoryLabel,
    wordCount: essay.word_count || (localized.body || "").split(/\s+/).length,
    timeRequired: `PT${essay.reading_minutes}M`,
    inLanguage: LOCALES[locale].htmlLang,
    isAccessibleForFree: true,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />
        <EssayReader
          essayId={essay._id}
          slug={slug}
          locale={locale}
          isTranslated={!!translation}
          essay={{
            title: localized.title,
            hook: localized.hook,
            body: localized.body as string,
            dateLabel: formatDate(essay.published_at, "medium"),
            readingMinutes: essay.reading_minutes,
            themeLabel: categoryLabel,
            category: essay.theme,
            issue: essay.issue,
            archived: essay.status === "archived",
            furtherReading: essay.further_reading,
            audioUrl: essay.audio_url,
            audioDuration: essay.audio_duration_seconds,
            bannerUrl: essayBannerInfo(essay)?.url ?? null,
            bannerTransparent: essayBannerInfo(essay)?.transparent ?? false,
          }}
          related={relatedProps}
          publishOn={essay.publish_on ? new Date(essay.publish_on).toISOString() : null}
          publishedAt={essay.published_at ? new Date(essay.published_at).toISOString() : null}
          releasedEverywhere={isReleasedEverywhere({
            publish_on: essay.publish_on,
            published_at: essay.published_at,
          })}
        />
      </main>
    </>
  );
}
