/**
 * Ordering for the archive list.
 *
 * Lives in its own module, outside the client component, because both sides
 * need it: the page pre-sorts on the server so the first paint is already in
 * the default order, and the list re-sorts on the client when the reader
 * switches. If the two disagreed by even one row, React would either warn about
 * a hydration mismatch or the list would visibly reshuffle on load.
 *
 * That also means the comparator has to be *total* — never returning 0 for two
 * different essays — or V8's sort could legitimately order equal-ranked items
 * differently on the server than in the browser. Every mode therefore falls
 * through to the essay's own date and then its href.
 */

export const SORT_MODES = ["popular", "new"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export const DEFAULT_SORT: SortMode = "popular";

export function isSortMode(value: unknown): value is SortMode {
  return (
    typeof value === "string" && (SORT_MODES as readonly string[]).includes(value)
  );
}

/** What "sortable" means here — the subset of ArchiveEntry ordering touches. */
export interface SortableEntry {
  href: string;
  likes?: number;
  publishOn?: string | null;
  publishedAt?: string | null;
}

/** When an essay went out, newest first. Missing dates sort last, not first. */
function entryTime(entry: SortableEntry): number {
  const raw = entry.publishOn || entry.publishedAt;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

function compare(a: SortableEntry, b: SortableEntry, mode: SortMode): number {
  if (mode === "popular") {
    // Readers who liked it, most first. Essays published too recently to have
    // collected any likes still land above older ones with none, because the
    // date tiebreak below runs for every pair at zero.
    const byLikes = (b.likes ?? 0) - (a.likes ?? 0);
    if (byLikes !== 0) return byLikes;
  }

  const byDate = entryTime(b) - entryTime(a);
  if (byDate !== 0) return byDate;

  // Final tiebreak so the order is identical on server and client.
  return a.href.localeCompare(b.href);
}

export function sortEntries<T extends SortableEntry>(
  entries: T[],
  mode: SortMode
): T[] {
  return [...entries].sort((a, b) => compare(a, b, mode));
}
