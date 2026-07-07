import type { NextRequest } from "next/server";

/** Best-effort client IP, preferring the edge-forwarded chains. */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    vercelForwardedFor?.split(",")[0]?.trim() ||
    realIp ||
    "unknown"
  );
}

/**
 * Two-letter ISO country code from Vercel's edge geolocation header.
 * Present in production on Vercel; null in local dev or when unavailable.
 */
export function getClientCountry(request: NextRequest): string | null {
  const country = request.headers.get("x-vercel-ip-country");
  return country && country.trim() ? country.trim().toUpperCase() : null;
}
