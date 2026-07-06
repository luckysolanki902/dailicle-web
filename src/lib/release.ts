export interface ReleaseDateFields {
  publish_on?: string | Date | null;
  published_at?: string | Date | null;
}

export function releaseSourceDate(item: ReleaseDateFields): Date | null {
  const value = item.publish_on || item.published_at;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function localReleaseDate(item: ReleaseDateFields): Date | null {
  const date = releaseSourceDate(item);
  if (!date) return null;

  // Stored publish dates are scheduling dates, not reveal instants. A
  // 2026-07-06T03:30Z publish_on should reveal at 2026-07-06 00:00 in the
  // reader's local timezone.
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function isReleasedLocally(item: ReleaseDateFields, now = new Date()): boolean {
  const release = localReleaseDate(item);
  return release ? release.getTime() <= now.getTime() : true;
}

export function startOfToday(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate());
}

export function thisOrNextMonday(from = new Date()): Date {
  const d = startOfToday(from);
  const days = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + days);
  return d;
}

export function nextMondayAfter(from = new Date()): Date {
  const d = startOfToday(from);
  const days = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + days);
  return d;
}
