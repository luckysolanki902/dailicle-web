"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThisWeek } from "@/components/landing/ThisWeek";
import { NextWeek } from "@/components/landing/NextWeek";
import { Ethos } from "@/components/landing/Ethos";
import { ReaderWord } from "@/components/landing/ReaderWord";
import { RecentEssays, EssayCard } from "@/components/landing/RecentEssays";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { formatDate } from "@/lib/utils";
import { themeLabel } from "@/lib/themes";
import {
  isReleasedLocally,
  localReleaseDate,
  nextMondayAfter,
  releaseSourceDate,
  thisOrNextMonday,
} from "@/lib/release";

interface LandingEssay {
  _id: string;
  slug?: string;
  title: string;
  hook: string;
  theme: string;
  reading_minutes: number;
  issue?: number | null;
  publish_on?: string | null;
  published_at?: string | null;
}

interface QueuedTopic {
  _id: string;
  title: string;
  theme: string;
}

interface HomeClientProps {
  published: LandingEssay[];
  queued: QueuedTopic[];
}

function hrefFor(essay: LandingEssay): string {
  return `/read/${essay.slug || essay._id}`;
}

function sortByReleaseAsc(a: LandingEssay, b: LandingEssay): number {
  return (releaseSourceDate(a)?.getTime() || 0) - (releaseSourceDate(b)?.getTime() || 0);
}

function sortByReleaseDesc(a: LandingEssay, b: LandingEssay): number {
  return sortByReleaseAsc(b, a);
}

export function HomeClient({ published, queued }: HomeClientProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const { hero, tease, cards } = useMemo(() => {
    const released = published
      .filter((essay) => isReleasedLocally(essay, now))
      .sort(sortByReleaseDesc);

    const unreleased = published
      .filter((essay) => !isReleasedLocally(essay, now))
      .sort(sortByReleaseAsc);

    const thisWeek = released[0] || null;
    const nextPublished = unreleased[0] || null;
    const nextQueued = queued[0] || null;

    const heroData = thisWeek
      ? {
          href: hrefFor(thisWeek),
          title: thisWeek.title,
          hook: thisWeek.hook,
          themeLabel: themeLabel(thisWeek.theme),
          issue: thisWeek.issue,
          dateLabel: formatDate(releaseSourceDate(thisWeek), "medium"),
          readingMinutes: thisWeek.reading_minutes,
        }
      : null;

    const nextPublishedRelease = nextPublished ? localReleaseDate(nextPublished) : null;
    const fallbackDate = heroData ? nextMondayAfter(now) : thisOrNextMonday(now);
    const teaseData = nextPublished
      ? {
          title: nextPublished.title,
          themeLabel: themeLabel(nextPublished.theme),
          dateLabel: formatDate(nextPublishedRelease, "medium"),
        }
      : nextQueued
        ? {
            title: nextQueued.title,
            themeLabel: themeLabel(nextQueued.theme),
            dateLabel: formatDate(fallbackDate, "medium"),
          }
        : null;

    const recentCards: EssayCard[] = released
      .filter((essay) => essay._id !== thisWeek?._id)
      .slice(0, 3)
      .map((essay) => ({
        href: hrefFor(essay),
        title: essay.title,
        hook: essay.hook,
        themeLabel: themeLabel(essay.theme),
        readingMinutes: essay.reading_minutes,
      }));

    return { hero: heroData, tease: teaseData, cards: recentCards };
  }, [now, published, queued]);

  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />

      <ThisWeek essay={hero} upcoming={!hero ? tease : null} />
      {hero && <NextWeek topic={tease} />}
      <Ethos />
      <ReaderWord />
      <RecentEssays essays={cards} />

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
  );
}
