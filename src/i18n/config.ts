/**
 * Single source of truth for the site's languages. Mirrors the server's
 * services/i18n_langs.py. `en` is the default and lives at the unprefixed root;
 * every other locale lives under its own path prefix (/es, /de, ...).
 */
export const DEFAULT_LOCALE = "en" as const;

export interface LocaleMeta {
  /** Language name in the language itself, for switcher labels. */
  native: string;
  /** English name, for aria labels / fallbacks. */
  english: string;
  /** OpenGraph locale code, e.g. es_ES. */
  ogLocale: string;
  /** BCP-47 tag for <html lang> / hreflang. */
  htmlLang: string;
}

export const LOCALES: Record<string, LocaleMeta> = {
  en: { native: "English", english: "English", ogLocale: "en_US", htmlLang: "en" },
  es: { native: "Español", english: "Spanish", ogLocale: "es_ES", htmlLang: "es" },
  de: { native: "Deutsch", english: "German", ogLocale: "de_DE", htmlLang: "de" },
  fr: { native: "Français", english: "French", ogLocale: "fr_FR", htmlLang: "fr" },
  ja: { native: "日本語", english: "Japanese", ogLocale: "ja_JP", htmlLang: "ja" },
  pt: { native: "Português", english: "Portuguese", ogLocale: "pt_BR", htmlLang: "pt" },
  it: { native: "Italiano", english: "Italian", ogLocale: "it_IT", htmlLang: "it" },
  ko: { native: "한국어", english: "Korean", ogLocale: "ko_KR", htmlLang: "ko" },
  ru: { native: "Русский", english: "Russian", ogLocale: "ru_RU", htmlLang: "ru" },
  tr: { native: "Türkçe", english: "Turkish", ogLocale: "tr_TR", htmlLang: "tr" },
};

export const LOCALE_CODES = Object.keys(LOCALES);
export type Locale = string;

/** Locales other than the default — the ones that carry a URL prefix. */
export const PREFIXED_LOCALES = LOCALE_CODES.filter((l) => l !== DEFAULT_LOCALE);

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && LOCALE_CODES.includes(value);
}

/**
 * Map an uppercase ISO country code (from the Vercel geo header) to the locale
 * we default that region to. Only regions whose primary language we support are
 * listed; everything else falls through to English. Switzerland → German and
 * Canada → English are deliberate plurality choices.
 */
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  VE: "es", EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", UY: "es",
  DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr",
  JP: "ja",
  BR: "pt", PT: "pt",
  IT: "it",
  KR: "ko",
  RU: "ru", KZ: "ru", BY: "ru", KG: "ru",
  TR: "tr",
};

/**
 * Split a pathname into its locale and the remaining (locale-less) path.
 * "/es/read/x" -> { locale: "es", path: "/read/x" }
 * "/read/x"    -> { locale: "en", path: "/read/x" }
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const seg = pathname.split("/")[1];
  if (isLocale(seg) && seg !== DEFAULT_LOCALE) {
    const rest = pathname.slice(seg.length + 1) || "/";
    return { locale: seg, path: rest.startsWith("/") ? rest : `/${rest}` };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/** Prefix a locale-less path for a locale. localeHref("/archive","es") -> "/es/archive". */
export function localeHref(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}

const SITE_URL = "https://dailicle.com";

/** Absolute URL for a locale-less path in a given locale. */
export function localeUrl(path: string, locale: Locale): string {
  return `${SITE_URL}${localeHref(path, locale)}`;
}

/**
 * The hreflang alternates map for a locale-less path: every locale's URL plus an
 * x-default pointing at English. Feed straight into Next's
 * `alternates.languages`.
 */
export function hreflangAlternates(path: string): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const code of LOCALE_CODES) {
    langs[LOCALES[code].htmlLang] = localeUrl(path, code);
  }
  langs["x-default"] = localeUrl(path, DEFAULT_LOCALE);
  return langs;
}
