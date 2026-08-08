import { HomeClient } from "@/components/landing/HomeClient";
import {
  getPublishedCandidates,
  getQueuedTopics,
  getTranslationsMap,
  essayBannerInfo,
} from "@/lib/essays";
import { getReadersByCountry } from "@/lib/readers";
import { getLikeCounts } from "@/lib/reactions";
import { buildHomeView, type LandingEssay, type QueuedTopic } from "@/lib/home-view";
import { makeThemeLabel } from "@/lib/themes";
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

export const revalidate = 3600; // weekly cadence – hourly revalidation is plenty

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const { t } = await getTranslations(locale);
  const title = t("home.meta.title");
  const description = t("home.meta.description");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: localeUrl("/", locale),
      type: "website",
      locale: LOCALES[locale].ogLocale,
      images: [
        { url: "/og-image.png", width: 1200, height: 630, alt: "The Dailicle – one essay a week" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    alternates: {
      canonical: localeUrl("/", locale),
      languages: hreflangAlternates("/"),
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;

  const [published, queued, readers, likes] = await Promise.all([
    getPublishedCandidates(20),
    getQueuedTopics(5),
    getReadersByCountry(),
    getLikeCounts(),
  ]);

  // One join to pull every listed essay's translated title/hook for this locale.
  const ids = [...published.map((e) => e._id), ...queued.map((q) => q._id)];
  const translations = await getTranslationsMap(ids, locale);

  const landingEssays: LandingEssay[] = published.map((essay) => {
    const tr = translations.get(essay._id);
    return {
      _id: essay._id,
      slug: essay.slug,
      title: tr?.title || essay.title,
      hook: tr?.hook || essay.hook,
      theme: essay.theme,
      reading_minutes: essay.reading_minutes,
      issue: essay.issue,
      publish_on: essay.publish_on ? new Date(essay.publish_on).toISOString() : null,
      published_at: essay.published_at ? new Date(essay.published_at).toISOString() : null,
      bannerUrl: essayBannerInfo(essay)?.url ?? null,
      bannerTransparent: essayBannerInfo(essay)?.transparent ?? false,
    };
  });

  const queuedTopics: QueuedTopic[] = queued.map((topic) => ({
    _id: topic._id,
    title: translations.get(topic._id)?.title || topic.title,
    theme: topic.theme,
  }));

  const { t } = await getTranslations(locale);
  const labelFor = makeThemeLabel(t);

  // Compute the time/timezone-dependent view once on the server so the client
  // can replay it verbatim on first render (see HomeClient / lib/home-view).
  const initialView = buildHomeView(
    landingEssays,
    queuedTopics,
    new Date(),
    labelFor,
    likes
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Dailicle",
    url: localeUrl("/", locale),
    description: t("home.meta.description"),
    inLanguage: LOCALES[locale].htmlLang,
    publisher: {
      "@type": "Organization",
      name: "The Dailicle",
      logo: {
        "@type": "ImageObject",
        url: "https://dailicle.com/logo.png",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient
        published={landingEssays}
        queued={queuedTopics}
        initialView={initialView}
        readers={readers}
        likes={likes}
      />
    </>
  );
}
