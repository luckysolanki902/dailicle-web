import { formatDate } from "@/lib/utils";
import { themeLabel } from "@/lib/themes";
import { sortEntries } from "@/lib/archive-sort";
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
  bannerTransparent?: boolean;
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
  bannerTransparent?: boolean;
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
  /** Ranked by likes — the strongest thing to hand someone who just finished. */
  popular: RecentCard[];
  cards: RecentCard[];
}

/** How many essays each group in "keep reading" shows. */
const POPULAR_COUNT = 3;
const RECENT_COUNT = 3;

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
  now: Date,
  labelFor: (theme: string) => string = themeLabel,
  /** Like counts keyed by essay `_id`, exactly as the archive keys them. */
  likes: Record<string, number> = {}
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
        themeLabel: labelFor(thisWeek.theme),
        issue: thisWeek.issue,
        dateLabel: formatDate(releaseSourceDate(thisWeek), "medium"),
        readingMinutes: thisWeek.reading_minutes,
        bannerUrl: thisWeek.bannerUrl ?? null,
        bannerTransparent: thisWeek.bannerTransparent ?? false,
      }
    : null;

  const nextPublishedRelease = nextPublished ? localReleaseDate(nextPublished) : null;
  const fallbackDate = hero ? nextMondayAfter(now) : thisOrNextMonday(now);
  const tease: TeaseCard | null = nextPublished
    ? {
        title: nextPublished.title,
        themeLabel: labelFor(nextPublished.theme),
        dateLabel: formatDate(nextPublishedRelease, "medium"),
      }
    : nextQueued
      ? {
          title: nextQueued.title,
          themeLabel: labelFor(nextQueued.theme),
          dateLabel: formatDate(fallbackDate, "medium"),
        }
      : null;

  const toCard = (essay: LandingEssay): RecentCard => ({
    href: hrefFor(essay),
    title: essay.title,
    hook: essay.hook,
    themeLabel: labelFor(essay.theme),
    readingMinutes: essay.reading_minutes,
  });

  // Everything already on the page is off the table — the hero is right there,
  // and an essay listed twice under two different headings reads as a bug.
  const rest = released.filter((essay) => essay._id !== thisWeek?._id);

  // Ranked by the same comparator the archive uses, so "most popular" means the
  // same thing in both places. With no likes yet it degrades to newest-first,
  // which is still a defensible order rather than an arbitrary one.
  const popularEssays = sortEntries(
    rest.map((essay) => ({
      essay,
      href: hrefFor(essay),
      likes: likes[essay._id] ?? 0,
      publishOn: essay.publish_on ?? null,
      publishedAt: essay.published_at ?? null,
    })),
    "popular"
  )
    .slice(0, POPULAR_COUNT)
    .map((entry) => entry.essay);

  const popularIds = new Set(popularEssays.map((essay) => essay._id));
  const popular: RecentCard[] = popularEssays.map(toCard);

  const cards: RecentCard[] = rest
    .filter((essay) => !popularIds.has(essay._id))
    .slice(0, RECENT_COUNT)
    .map(toCard);

  return { hero, tease, popular, cards };
}
