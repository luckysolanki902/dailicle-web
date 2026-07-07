import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a stored date for display. Weekly essays go live when the pipeline
 * publishes them – no reveal-time gymnastics, the stored date is the date.
 */
export function formatDate(
  value: Date | string | null | undefined,
  style: "short" | "medium" | "iso" = "medium"
): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  if (style === "iso") return date.toISOString().split("T")[0];

  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { month: "short", day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

/** The Monday the next essay arrives (strictly in the future). */
export function nextMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  const days = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + days);
  return d;
}
