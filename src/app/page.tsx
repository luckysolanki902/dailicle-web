import { Hero } from "@/components/landing/Hero";
import { ValueProps } from "@/components/landing/ValueProps";
import { Sources } from "@/components/landing/Sources";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getLatestArticle } from "@/lib/articles";
import type { Metadata } from "next";

export const revalidate = 360; // Revalidate every 6 minutes

export const metadata: Metadata = {
  title: "The Dailicle - One Transformative Essay Every Day | Deep Reading for Curious Minds",
  description: "Escape doomscrolling with The Dailicle. One deeply researched, AI-powered essay daily on psychology, philosophy, and startup wisdom. Free, no signup, distraction-free reading for ambitious builders.",
  openGraph: {
    title: "The Dailicle - One Transformative Essay Every Day",
    description: "Escape doomscrolling with deeply researched essays on psychology, philosophy, and startup wisdom. Published daily at 9 AM IST.",
    url: "https://dailicle.com",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "The Dailicle - Daily Essays for Curious Minds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dailicle - One Transformative Essay Every Day",
    description: "Escape doomscrolling with deeply researched essays on psychology, philosophy, and startup wisdom.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://dailicle.com",
  },
};

export default async function Home() {
  const latestArticle = await getLatestArticle();

  // Fallback if no article found (e.g. DB empty)
  const todayTopic = latestArticle ? {
    id: latestArticle._id,
    title: latestArticle.topic_title,
    teaser: latestArticle.topic_rationale,
    readTime: latestArticle.reading_time_minutes,
  } : {
    id: "#",
    title: "No Article Today",
    teaser: "The ink is dry. Come back tomorrow.",
    readTime: 0,
  };

  // Structured Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "The Dailicle",
    "url": "https://dailicle.com",
    "description": "One deeply researched essay every day on psychology, philosophy, and startup wisdom.",
    "publisher": {
      "@type": "Organization",
      "name": "The Dailicle",
      "logo": {
        "@type": "ImageObject",
        "url": "https://dailicle.com/logo.png"
      }
    },
    "potentialAction": {
      "@type": "ReadAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://dailicle.com/read/{id}",
        "actionPlatform": [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform"
        ]
      }
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />
        <Hero todayTopic={todayTopic} />
        <Sources />
        <ValueProps />
        
        {/* Footer CTA */}
        <section className="py-32 px-6 text-center bg-foreground/5">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to think deeper?</h2>
            <p className="text-xl text-foreground/70">
              Join thousands who start their day with insight.
              <br />
              <span className="text-base text-foreground/50">No signup. No spam. Just wisdom.</span>
            </p>
            <div className="pt-6">
              <a 
                href={`/read/${todayTopic.id}`}
                className="inline-flex items-center gap-2 px-10 py-5 bg-foreground text-background rounded-full text-lg font-semibold hover:scale-105 transition-transform shadow-lg"
              >
                Start Reading Today
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
