import { HomeClient } from "@/components/landing/HomeClient";
import { getPublishedCandidates, getQueuedTopics } from "@/lib/essays";
import type { Metadata } from "next";

export const revalidate = 3600; // weekly cadence — hourly revalidation is plenty

const DESCRIPTION =
  "A weekly essay on the mind, meaning, money, and how to live. Carefully researched, free to read, nothing to sign up for — a new one every Monday.";

export const metadata: Metadata = {
  title: "The Dailicle — One essay a week, written to be read slowly",
  description: DESCRIPTION,
  openGraph: {
    title: "The Dailicle — One essay a week, written to be read slowly",
    description: DESCRIPTION,
    url: "https://dailicle.com",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "The Dailicle — one essay a week",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dailicle — One essay a week, written to be read slowly",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://dailicle.com",
  },
};

export default async function Home() {
  const [published, queued] = await Promise.all([
    getPublishedCandidates(20),
    getQueuedTopics(5),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Dailicle",
    url: "https://dailicle.com",
    description: DESCRIPTION,
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
        published={published.map((essay) => ({
          _id: essay._id,
          slug: essay.slug,
          title: essay.title,
          hook: essay.hook,
          theme: essay.theme,
          reading_minutes: essay.reading_minutes,
          issue: essay.issue,
          publish_on: essay.publish_on ? new Date(essay.publish_on).toISOString() : null,
          published_at: essay.published_at ? new Date(essay.published_at).toISOString() : null,
        }))}
        queued={queued.map((topic) => ({
          _id: topic._id,
          title: topic.title,
          theme: topic.theme,
        }))}
      />
    </>
  );
}
