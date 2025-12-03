import { ArticleReader } from "@/components/reader/ArticleReader";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getArticleById } from "@/lib/articles";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 360; // Revalidate every 6 minutes

// Generate dynamic metadata for each article
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const articleData = await getArticleById(id);

  if (!articleData) {
    return {
      title: "Article Not Found",
      description: "The requested article could not be found.",
    };
  }

  const description = articleData.topic_rationale || `Read this deeply researched essay on ${articleData.category || 'various topics'}. A ${articleData.reading_time_minutes}-minute read exploring ${articleData.topic_title}.`;
  
  return {
    title: `${articleData.topic_title}`,
    description: description.slice(0, 160),
    keywords: [
      articleData.category,
      ...articleData.tags || [],
      "deep reading",
      "thoughtful essay",
      "long-form article",
      "intellectual content",
    ],
    authors: [{ name: "Lucky Solanki" }],
    openGraph: {
      title: articleData.topic_title,
      description: description.slice(0, 200),
      url: `https://dailicle.com/read/${id}`,
      type: "article",
      publishedTime: articleData.date_str,
      authors: ["Lucky Solanki"],
      tags: articleData.tags || [articleData.category],
      images: [
        {
          url: `/og-article.png`,
          width: 1200,
          height: 630,
          alt: articleData.topic_title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: articleData.topic_title,
      description: description.slice(0, 200),
      images: [`/og-article.png`],
    },
    alternates: {
      canonical: `https://dailicle.com/read/${id}`,
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
    date: articleData.date_str,
    readTime: articleData.reading_time_minutes,
    category: articleData.category,
    youtube: articleData.youtube,
    papers: articleData.papers,
  };
  
  // Structured Data for SEO
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
      "logo": {
        "@type": "ImageObject",
        "url": "https://dailicle.com/logo.png"
      }
    },
    "datePublished": articleData.date_str,
    "dateModified": articleData.date_str,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://dailicle.com/read/${id}`
    },
    "image": "https://dailicle.com/og-article.png",
    "articleSection": articleData.category,
    "keywords": articleData.tags?.join(", ") || articleData.category,
    "wordCount": articleData.article_markdown?.split(/\s+/).length || 0,
    "timeRequired": `PT${articleData.reading_time_minutes}M`,
    "citation": [
      ...(articleData.papers || []).map((paper: any) => ({
        "@type": "ScholarlyArticle",
        "name": paper.title,
        "url": paper.url
      })),
      ...(articleData.youtube || []).map((video: any) => ({
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
