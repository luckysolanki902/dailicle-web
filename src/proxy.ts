import { NextRequest, NextResponse } from "next/server";
import {
  COUNTRY_TO_LOCALE,
  DEFAULT_LOCALE,
  PREFIXED_LOCALES,
  isLocale,
  type Locale,
} from "@/i18n/config";

const COOKIE = "NEXT_LOCALE";

function cookieLocale(req: NextRequest): Locale | null {
  const value = req.cookies.get(COOKIE)?.value;
  return isLocale(value) ? (value as Locale) : null;
}

function geoLocale(req: NextRequest): Locale | null {
  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country") ||
    "";
  return COUNTRY_TO_LOCALE[country.toUpperCase()] ?? null;
}

/**
 * Routing policy (path-prefix, English unprefixed):
 *  - /es, /de, ...        -> pass straight through to the [lang] route.
 *  - /en/...              -> permanent-redirect to the canonical unprefixed URL.
 *  - / (homepage only)    -> first-time / cookie'd non-English visitors are
 *                            redirected to their locale (region default). This
 *                            is the only auto-redirect, and it's on the
 *                            language-neutral homepage — deep links never move.
 *  - everything else      -> rewritten internally to /en/... so the [lang]
 *                            route matches, while the browser URL stays clean.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const seg = pathname.split("/")[1];

  // Already an explicitly-prefixed non-default locale: let it render.
  if (PREFIXED_LOCALES.includes(seg)) {
    return NextResponse.next();
  }

  // Never expose /en — collapse it to the unprefixed canonical URL.
  if (seg === DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  // Homepage region default. Cookie beats geo; both only redirect off English.
  if (pathname === "/") {
    const desired = cookieLocale(req) ?? geoLocale(req);
    if (desired && desired !== DEFAULT_LOCALE) {
      const url = req.nextUrl.clone();
      url.pathname = `/${desired}`;
      const res = NextResponse.redirect(url, 307);
      res.cookies.set(COOKIE, desired, { path: "/", maxAge: 60 * 60 * 24 * 365 });
      return res;
    }
  }

  // Unprefixed English content: render the [lang] route without a visible prefix.
  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes, Next internals, and any file with an extension (sitemap.xml,
  // robots.txt, feed.xml, favicon.ico, images, etc.).
  matcher: ["/((?!api|_next/static|_next/image|_vercel|.*\\..*).*)"],
};
