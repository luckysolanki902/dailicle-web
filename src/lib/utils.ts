import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if it's past 9 AM in the user's local timezone.
 * Used to determine whether to show today's article or yesterday's.
 */
export function isPast9AM(): boolean {
  const now = new Date();
  return now.getHours() >= 9;
}

/**
 * Check if an article was published today (in user's local timezone).
 * Compares the article's UTC date converted to local date.
 */
export function isPublishedToday(articleDate: Date | string): boolean {
  const now = new Date();
  const pubDate = new Date(articleDate);
  
  // Compare dates in local timezone
  const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pubLocal = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
  
  return nowLocal.getTime() === pubLocal.getTime();
}

/**
 * Check if an article should be visible based on the 9 AM rule.
 * An article is visible if:
 * - It was published before today, OR
 * - It was published today AND it's past 9 AM
 * 
 * Note: This function uses the raw article generation date from the database,
 * not the display date (which adds 1 day). This is intentional - we check visibility
 * based on when the article was created, while the display date shows when it's meant
 * to be read (after 9 AM the next day).
 */
export function isArticleVisible(articleDate: Date | string): boolean {
  const now = new Date();
  const pubDate = new Date(articleDate);
  
  // Get today's date at midnight (local time)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Get article's publication date at midnight (local time)  
  const pubMidnight = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
  
  // If article is from before today, it's always visible
  if (pubMidnight < todayMidnight) {
    return true;
  }
  
  // If article is from today, only visible after 9 AM
  if (pubMidnight.getTime() === todayMidnight.getTime()) {
    return now.getHours() >= 9;
  }
  
  // Future articles are not visible
  return false;
}

/**
 * Determine which article to show based on the 9 AM rule:
 * - Before 9 AM local time: show previous article (if today's exists)
 * - After 9 AM local time: show latest article
 * 
 * @param latestArticle - The most recent article
 * @param previousArticle - The second most recent article (optional)
 * @returns The article to display
 */
export function getArticleForCurrentTime<T extends { createdAt?: string; date?: string }>(
  latestArticle: T,
  previousArticle?: T
): T {
  // If no previous article exists, always show latest
  if (!previousArticle) {
    return latestArticle;
  }
  
  // Use createdAt (ISO timestamp) if available, otherwise fall back to date
  const articleTimestamp = latestArticle.createdAt || latestArticle.date;
  
  // Check if latest article is visible based on 9 AM rule
  if (articleTimestamp && isArticleVisible(articleTimestamp)) {
    return latestArticle;
  }
  
  // Latest article not yet visible (before 9 AM today), show previous
  return previousArticle;
}

/**
 * Format article date for display.
 * Articles are generated at ~1 AM UTC (intended for the next day after 9 AM).
 * This function adds 1 day to the article's generation date to show the correct display date.
 * 
 * @param articleDate - The article's date field (Date object or ISO string)
 * @param format - Optional format: 'short' (Dec 17), 'medium' (Dec 17, 2025), 'iso' (2025-12-17)
 * @returns Formatted date string
 */
export function formatArticleDisplayDate(
  articleDate: Date | string,
  format: 'short' | 'medium' | 'iso' = 'medium'
): string {
  // Parse the date
  const date = new Date(articleDate);
  
  // Validate the date
  if (isNaN(date.getTime())) {
    console.error(`Invalid date provided to formatArticleDisplayDate: ${articleDate}`);
    return 'Invalid Date';
  }
  
  // Add 1 day (24 hours in milliseconds)
  const displayDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  
  if (format === 'iso') {
    // Return ISO format: YYYY-MM-DD
    return displayDate.toISOString().split('T')[0];
  }
  
  // Format as human-readable date in the user's locale
  const options: Intl.DateTimeFormatOptions = 
    format === 'short'
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  
  return displayDate.toLocaleDateString('en-US', options);
}
