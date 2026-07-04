import { ThisWeek } from "@/components/landing/ThisWeek";
import { NextWeek } from "@/components/landing/NextWeek";
import { Ethos } from "@/components/landing/Ethos";
import { ReaderWord } from "@/components/landing/ReaderWord";
import { RecentEssays, EssayCard } from "@/components/landing/RecentEssays";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getThisWeek, getNextTopic, getPublishedEssays } from "@/lib/essays";
import { themeLabel } from "@/lib/themes";
import { formatDate, nextMonday } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  const [thisWeek, nextTopic, published] = await Promise.all([
    getThisWeek(),
    getNextTopic(),
    getPublishedEssays(5),
  ]);

  const hero = thisWeek
    ? {
        href: `/read/${thisWeek.slug || thisWeek._id}`,
        title: thisWeek.title,
        hook: thisWeek.hook,
        themeLabel: themeLabel(thisWeek.theme),
        issue: thisWeek.issue,
        dateLabel: formatDate(thisWeek.published_at, "medium"),
        readingMinutes: thisWeek.reading_minutes,
      }
    : null;

  const comingMonday = formatDate(nextMonday(), "medium");

  const tease = nextTopic
    ? {
        title: nextTopic.title,
        themeLabel: themeLabel(nextTopic.theme),
        dateLabel: comingMonday,
      }
    : null;

  // "Keep reading": recent published essays beyond the hero — current era only
  const cards: EssayCard[] = published
    .filter((e) => e._id !== thisWeek?._id)
    .slice(0, 3)
    .map((e) => ({
      href: `/read/${e.slug || e._id}`,
      title: e.title,
      hook: e.hook,
      themeLabel: themeLabel(e.theme),
      readingMinutes: e.reading_minutes,
    }));

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
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />

        <ThisWeek essay={hero} upcoming={!hero ? tease : null} />
        {hero && <NextWeek topic={tease} />}
        <Ethos />
        <ReaderWord />
        <RecentEssays essays={cards} />

        {/* Closing — quiet, honest */}
        <section className="py-24 px-6 text-center border-t border-foreground/10">
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-balance">
              The next essay arrives Monday.
              {hero && <span className="block">This week&apos;s is already here.</span>}
            </h2>
            <div className="pt-2">
              <Link
                href={hero ? hero.href : "/archive"}
                className="group inline-flex items-center gap-3 px-9 py-4 bg-foreground text-background rounded-full text-base font-medium transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                <span>{hero ? "Start reading" : "Visit the archive"}</span>
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <p className="text-xs text-foreground/40">
              Free to read · nothing to sign up for · no ads
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
