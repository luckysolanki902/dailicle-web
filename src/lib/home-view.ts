import { formatDate } from "@/lib/utils";
import { themeLabel } from "@/lib/themes";
import {
  isReleasedLocally,
  localReleaseDate,
  nextMondayAfter,
  releaseSourceDate,
  thisOrNextMonday,
} from "@/lib/release";

export interface LandingEssay {
  _id: string;
  slug?: string;
  title: string;
  hook: string;
  theme: string;
  reading_minutes: number;
  issue?: number | null;
  publish_on?: string | null;
  published_at?: string | null;
  /** Resolved CDN banner URL, if the essay has an enabled banner. */
  bannerUrl?: string | null;
}

export interface QueuedTopic {
  _id: string;
  title: string;
  theme: string;
}

export interface HeroCard {
  href: string;
  title: string;
  hook: string;
  themeLabel: string;
  issue?: number | null;
  dateLabel: string;
  readingMinutes: number;
  bannerUrl?: string | null;
}

export interface TeaseCard {
  title: string;
  themeLabel: string;
  dateLabel: string;
}

export interface RecentCard {
  href: string;
  title: string;
  hook: string;
  themeLabel: string;
  readingMinutes: number;
}

export interface HomeView {
  hero: HeroCard | null;
  tease: TeaseCard | null;
  cards: RecentCard[];
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

/**
 * Pure, deterministic-for-a-given-`now` derivation of the landing page.
 *
 * The release calendar is intentionally the reader's LOCAL calendar (see
 * lib/release), and `now` also differs between a cached server render and a
 * live client. Both make this output time/timezone dependent, so it must never
 * be recomputed during hydration – the server computes it once and the client
 * replays that same result on first render, then recomputes after mount.
 */
export function buildHomeView(
  published: LandingEssay[],
  queued: QueuedTopic[],
  now: Date
): HomeView {
  const released = published
    .filter((essay) => isReleasedLocally(essay, now))
    .sort(sortByReleaseDesc);

  const unreleased = published
    .filter((essay) => !isReleasedLocally(essay, now))
    .sort(sortByReleaseAsc);

  const thisWeek = released[0] || null;
  const nextPublished = unreleased[0] || null;
  const nextQueued = queued[0] || null;

  const hero: HeroCard | null = thisWeek
    ? {
        href: hrefFor(thisWeek),
        title: thisWeek.title,
        hook: thisWeek.hook,
        themeLabel: themeLabel(thisWeek.theme),
        issue: thisWeek.issue,
        dateLabel: formatDate(releaseSourceDate(thisWeek), "medium"),
        readingMinutes: thisWeek.reading_minutes,
        bannerUrl: thisWeek.bannerUrl ?? null,
      }
    : null;

  const nextPublishedRelease = nextPublished ? localReleaseDate(nextPublished) : null;
  const fallbackDate = hero ? nextMondayAfter(now) : thisOrNextMonday(now);
  const tease: TeaseCard | null = nextPublished
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

  const cards: RecentCard[] = released
    .filter((essay) => essay._id !== thisWeek?._id)
    .slice(0, 3)
    .map((essay) => ({
      href: hrefFor(essay),
      title: essay.title,
      hook: essay.hook,
      themeLabel: themeLabel(essay.theme),
      readingMinutes: essay.reading_minutes,
    }));

  return { hero, tease, cards };
}
