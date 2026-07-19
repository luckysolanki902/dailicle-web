import { EssayReader } from "@/components/reader/EssayReader";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getEssay, getNextTopic, getAllReadable, essayBannerUrl } from "@/lib/essays";
import { themeLabel } from "@/lib/themes";
import { formatDate, nextMonday } from "@/lib/utils";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Essays change at most weekly, so there's no reason to revalidate hourly.
// A day-long window keeps background regeneration (and its CPU) ~24x lower;
// the admin can still force an update via on-demand revalidation.
export const revalidate = 86400;

/**
 * Prebuild every listed essay so the hottest route serves from the CDN
 * instead of rendering on demand. dynamicParams stays on (the default), so
 * unlisted essays and legacy ObjectId URLs still render on first request and
 * then cache via ISR.
 */
export async function generateStaticParams() {
  const essays = await getAllReadable();
  return essays
    .filter((essay) => essay.slug)
    .map((essay) => ({ id: essay.slug as string }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const essay = await getEssay(id);

  if (!essay) {
    return {
      title: "Essay Not Found - The Dailicle",
      description: "The requested essay could not be found.",
    };
  }

  const canonicalPath = `/read/${essay.slug || essay._id}`;
  const description = (essay.hook ||
    `An essay from The Dailicle. A ${essay.reading_minutes}-minute read.`).slice(0, 160);

  // Prefer the essay's own banner illustration for social cards; fall back to
  // the dynamically-rendered OG card when the essay has no banner.
  const banner = essayBannerUrl(essay);
  const ogImageUrl = new URL("https://dailicle.com/api/og");
  ogImageUrl.searchParams.set("title", essay.title);
  ogImageUrl.searchParams.set("category", themeLabel(essay.theme));
  ogImageUrl.searchParams.set("minimal", "true");

  const ogImage = banner
    ? { url: banner, width: 2560, height: 1024, alt: essay.title, type: "image/png" }
    : {
        url: ogImageUrl.toString(),
        width: 1200,
        height: 630,
        alt: essay.title,
        type: "image/png",
      };

  return {
    title: `${essay.title} - The Dailicle`,
    description,
    keywords: [
      themeLabel(essay.theme),
      "essay",
      "weekly essay",
      "long-form writing",
      "thoughtful reading",
    ],
    authors: [{ name: "The Dailicle Desk", url: "https://dailicle.com" }],
    publisher: "The Dailicle",
    openGraph: {
      title: `${essay.title} | The Dailicle`,
      description,
      url: `https://dailicle.com${canonicalPath}`,
      siteName: "The Dailicle",
      locale: "en_US",
      type: "article",
      publishedTime: formatDate(essay.published_at, "iso"),
      authors: ["The Dailicle Desk"],
      section: themeLabel(essay.theme),
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      site: "@dailicle",
      title: `${essay.title} | The Dailicle`,
      description,
      images: { url: ogImage.url, alt: essay.title },
    },
    alternates: {
      canonical: `https://dailicle.com${canonicalPath}`,
    },
  };
}

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [essay, nextTopic] = await Promise.all([getEssay(id), getNextTopic()]);

  if (!essay || !essay.body) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: essay.title,
    description: essay.hook,
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
      "@id": `https://dailicle.com/read/${essay.slug || essay._id}`,
    },
    articleSection: themeLabel(essay.theme),
    wordCount: essay.word_count || essay.body.split(/\s+/).length,
    timeRequired: `PT${essay.reading_minutes}M`,
    inLanguage: "en-US",
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
          essay={{
            title: essay.title,
            hook: essay.hook,
            body: essay.body,
            dateLabel: formatDate(essay.published_at, "medium"),
            readingMinutes: essay.reading_minutes,
            themeLabel: themeLabel(essay.theme),
            category: essay.theme,
            issue: essay.issue,
            archived: essay.status === "archived",
            furtherReading: essay.further_reading,
            audioUrl: essay.audio_url,
            audioDuration: essay.audio_duration_seconds,
            bannerUrl: essayBannerUrl(essay),
          }}
          nextTease={
            nextTopic
              ? {
                  title: nextTopic.title,
                  dateLabel: formatDate(nextMonday(), "medium"),
                }
              : null
          }
          publishOn={essay.publish_on ? new Date(essay.publish_on).toISOString() : null}
          publishedAt={essay.published_at ? new Date(essay.published_at).toISOString() : null}
        />
      </main>
    </>
  );
}
