import { ArticleReader } from "@/components/reader/ArticleReader";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getArticleById, Resource } from "@/lib/articles";
import { formatArticleDisplayDate } from "@/lib/utils";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 360; // Revalidate every 6 minutes

// Generate dynamic metadata for each article
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const articleData = await getArticleById(id);

  if (!articleData) {
    return {
      title: "Article Not Found - Dailicle",
      description: "The requested article could not be found.",
      openGraph: {
        title: "Article Not Found - Dailicle",
        description: "The requested article could not be found.",
        images: [{ url: "https://dailicle.com/og-image.png" }],
      },
      twitter: {
        card: "summary_large_image",
        images: ["https://dailicle.com/og-image.png"],
      },
    };
  }

  const description = articleData.topic_rationale || `Read this deeply researched essay on ${articleData.category || 'various topics'}. A ${articleData.reading_time_minutes}-minute read exploring ${articleData.topic_title}.`;
  const fullTitle = `${articleData.topic_title} - Dailicle`;
  const ogTitle = `${articleData.topic_title} | Dailicle`;
  
  // Build dynamic OG image URL with article details (only category + title)
  const ogImageUrl = new URL('https://dailicle.com/api/og');
  ogImageUrl.searchParams.set('title', articleData.topic_title);
  ogImageUrl.searchParams.set('category', articleData.category || '');
  ogImageUrl.searchParams.set('minimal', 'true');
  
  return {
    title: fullTitle,
    description: description.slice(0, 160),
    keywords: [
      articleData.category,
      ...(articleData.tags || []),
      "deep reading",
      "thoughtful essay",
      "long-form article",
      "intellectual content",
      "daily essay",
      "research-based",
    ],
    authors: [{ name: "Lucky Solanki", url: "https://dailicle.com" }],
    creator: "Lucky Solanki",
    publisher: "The Dailicle",
    openGraph: {
      title: ogTitle,
      description: description.slice(0, 200),
      url: `https://dailicle.com/read/${id}`,
      siteName: "The Dailicle",
      locale: "en_US",
      type: "article",
      publishedTime: formatArticleDisplayDate(articleData.date, 'iso'),
      modifiedTime: formatArticleDisplayDate(articleData.date, 'iso'),
      authors: ["Lucky Solanki"],
      section: articleData.category,
      tags: articleData.tags || [articleData.category],
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: articleData.topic_title,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@dailicle",
      creator: "@luckysolanki",
      title: ogTitle,
      description: description.slice(0, 200),
      images: {
        url: ogImageUrl.toString(),
        alt: articleData.topic_title,
      },
    },
    alternates: {
      canonical: `https://dailicle.com/read/${id}`,
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
}

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const articleData = await getArticleById(id);

  if (!articleData) {
    notFound();
  }

  const article = {
    title: articleData.topic_title,
    content: articleData.article_markdown,
    date: formatArticleDisplayDate(articleData.date, 'medium'),
    readTime: articleData.reading_time_minutes,
    category: articleData.category,
    youtube: articleData.youtube,
    papers: articleData.papers,
    audioUrl: articleData.audio_url,
    audioDuration: articleData.audio_duration_seconds,
  };
  
  // Build dynamic OG image URL for JSON-LD
  const ogImageUrl = new URL('https://dailicle.com/api/og');
  ogImageUrl.searchParams.set('title', articleData.topic_title);
  ogImageUrl.searchParams.set('category', articleData.category || '');
  ogImageUrl.searchParams.set('readTime', `${articleData.reading_time_minutes || ''} min read`);
  
  // Structured Data for SEO (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": articleData.topic_title,
    "description": articleData.topic_rationale,
    "author": {
      "@type": "Person",
      "name": "Lucky Solanki",
      "url": "https://dailicle.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "The Dailicle",
      "url": "https://dailicle.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://dailicle.com/logo.png"
      }
    },
    "datePublished": formatArticleDisplayDate(articleData.date, 'iso'),
    "dateModified": formatArticleDisplayDate(articleData.date, 'iso'),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://dailicle.com/read/${id}`
    },
    "image": {
      "@type": "ImageObject",
      "url": ogImageUrl.toString(),
      "width": 1200,
      "height": 630
    },
    "articleSection": articleData.category,
    "keywords": articleData.tags?.join(", ") || articleData.category,
    "wordCount": articleData.article_markdown?.split(/\s+/).length || 0,
    "timeRequired": `PT${articleData.reading_time_minutes}M`,
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "citation": [
      ...(articleData.papers || []).map((paper: Resource) => ({
        "@type": "ScholarlyArticle",
        "name": paper.title,
        "url": paper.url
      })),
      ...(articleData.youtube || []).map((video: Resource) => ({
        "@type": "VideoObject",
        "name": video.title,
        "url": video.url
      }))
    ]
  };
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />
        <ArticleReader article={article} />
      </main>
    </>
  );
}
