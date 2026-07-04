import { ArchiveList, ArchiveEntry } from "@/components/archive/ArchiveList";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getPublishedEssays, getArchived2025, Essay } from "@/lib/essays";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const revalidate = 3600;

const DESCRIPTION =
  "Every essay we've published — one a week on the mind, meaning, money, and how to live.";

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

function toEntry(essay: Essay): ArchiveEntry {
  return {
    href: `/read/${essay.slug || essay._id}`,
    title: essay.title,
    hook: essay.hook,
    theme: essay.theme,
    readingMinutes: essay.reading_minutes,
    dateLabel: formatDate(essay.published_at, "medium"),
    issue: essay.issue,
  };
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme } = await searchParams;
  const [published, archived] = await Promise.all([
    getPublishedEssays(),
    getArchived2025(),
  ]);

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
          current={published.map(toEntry)}
          legacy={archived.map(toEntry)}
          initialTheme={theme}
        />
      </main>
    </>
  );
}
