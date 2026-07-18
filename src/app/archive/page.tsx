import { ArchiveList, ArchiveEntry } from "@/components/archive/ArchiveList";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getPublishedEssays, getArchived2025, Essay } from "@/lib/essays";
import { formatDate } from "@/lib/utils";
import { isReleasedLocally } from "@/lib/release";
import type { Metadata } from "next";

// The archive listing only changes when a new essay ships (weekly), so a
// day-long revalidate window is plenty and keeps background renders cheap.
export const revalidate = 86400;

const DESCRIPTION =
  "Every essay we've published – one a week on the mind, meaning, money, and how to live.";

export const metadata: Metadata = {
  title: "The Essays - Archive | The Dailicle",
  description: DESCRIPTION,
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
    title: "The Essays - Archive | The Dailicle",
    description: DESCRIPTION,
    url: "https://dailicle.com/archive",
    siteName: "The Dailicle",
    locale: "en_US",
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
    title: "The Essays - Archive | The Dailicle",
    description: DESCRIPTION,
    images: {
      url: "https://dailicle.com/og-archive.png",
      alt: "The Dailicle Archive",
    },
  },
  alternates: {
    canonical: "https://dailicle.com/archive",
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

function toEntry(essay: Essay, now: Date): ArchiveEntry {
  return {
    href: `/read/${essay.slug || essay._id}`,
    title: essay.title,
    hook: essay.hook,
    theme: essay.theme,
    readingMinutes: essay.reading_minutes,
    dateLabel: formatDate(essay.published_at, "medium"),
    publishOn: essay.publish_on ? new Date(essay.publish_on).toISOString() : null,
    publishedAt: essay.published_at ? new Date(essay.published_at).toISOString() : null,
    issue: essay.issue,
    initialReleased: isReleasedLocally(
      { publish_on: essay.publish_on, published_at: essay.published_at },
      now
    ),
  };
}

export default async function ArchivePage() {
  const [published, archived] = await Promise.all([
    getPublishedEssays(),
    getArchived2025(),
  ]);

  const now = new Date();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "The Dailicle Archive",
    description: DESCRIPTION,
    url: "https://dailicle.com/archive",
    publisher: {
      "@type": "Organization",
      name: "The Dailicle",
    },
    hasPart: [...published, ...archived].map((essay) => ({
      "@type": "Article",
      headline: essay.title,
      datePublished: formatDate(essay.published_at, "iso"),
      url: `https://dailicle.com/read/${essay.slug || essay._id}`,
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
          current={published.map((essay) => toEntry(essay, now))}
          legacy={archived.map((essay) => toEntry(essay, now))}
        />
      </main>
    </>
  );
}
