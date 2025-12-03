import { ArchiveList } from "@/components/archive/ArchiveList";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getArticles } from "@/lib/articles";
import type { Metadata } from "next";

export const revalidate = 360; // Revalidate every 6 minutes

export const metadata: Metadata = {
  title: "Archive - Browse All Daily Essays | The Dailicle",
  description: "Browse our complete archive of deeply researched essays on psychology, philosophy, startup wisdom, and more. Search through hundreds of thought-provoking articles designed for curious minds and ambitious builders.",
  keywords: [
    "essay archive",
    "philosophy articles",
    "psychology essays",
    "startup wisdom archive",
    "deep reading archive",
    "thoughtful content library",
    "curated essays",
    "long-form articles collection",
    "intellectual content archive",
    "doomscrolling"
  ],
  authors: [{ name: "Lucky Solanki", url: "https://dailicle.vercel.app" }],
  creator: "Lucky Solanki",
  publisher: "The Dailicle",
  openGraph: {
    title: "Archive - Browse All Daily Essays | The Dailicle",
    description: "Browse hundreds of deeply researched essays on psychology, philosophy, and startup wisdom. Search and discover thought-provoking content.",
    url: "https://dailicle.vercel.app/archive",
    siteName: "The Dailicle",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://dailicle.vercel.app/og-archive.png",
        width: 1200,
        height: 630,
        alt: "The Dailicle Archive - Browse All Essays",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@dailicle",
    creator: "@luckysolanki",
    title: "Archive - Browse All Daily Essays",
    description: "Browse hundreds of deeply researched essays on psychology, philosophy, and startup wisdom.",
    images: {
      url: "https://dailicle.vercel.app/og-archive.png",
      alt: "The Dailicle Archive - Browse All Essays",
    },
  },
  alternates: {
    canonical: "https://dailicle.vercel.app/archive",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const currentPage = Number(page) || 1;
  const searchQuery = q || "";
  
  const { articles, totalPages } = await getArticles(currentPage, 10, searchQuery);

  // Structured Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "The Dailicle Archive",
    "description": "Browse our complete archive of deeply researched essays on psychology, philosophy, and startup wisdom.",
    "url": "https://dailicle.vercel.app/archive",
    "publisher": {
      "@type": "Organization",
      "name": "The Dailicle"
    },
    "hasPart": articles.map((article: any) => ({
      "@type": "Article",
      "headline": article.topic_title,
      "datePublished": article.date_str,
      "url": `https://dailicle.vercel.app/read/${article._id}`,
      "author": {
        "@type": "Person",
        "name": "Lucky Solanki"
      }
    }))
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
          initialArticles={articles} 
          totalPages={totalPages} 
          currentPage={currentPage}
          initialSearch={searchQuery}
        />
      </main>
    </>
  );
}
