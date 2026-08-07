import "server-only";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { createTranslator, type Messages, type TFunction } from "@/i18n/translator";
import en from "@/i18n/messages/en.json";

// Every locale catalog is statically importable so the bundle contains only the
// requested one and there is no runtime fs access (works on the edge/CDN).
const catalogs: Record<string, () => Promise<{ default: Messages }>> = {
  es: () => import("@/i18n/messages/es.json"),
  de: () => import("@/i18n/messages/de.json"),
  fr: () => import("@/i18n/messages/fr.json"),
  ja: () => import("@/i18n/messages/ja.json"),
  pt: () => import("@/i18n/messages/pt.json"),
  it: () => import("@/i18n/messages/it.json"),
  ko: () => import("@/i18n/messages/ko.json"),
  ru: () => import("@/i18n/messages/ru.json"),
  tr: () => import("@/i18n/messages/tr.json"),
  zh: () => import("@/i18n/messages/zh.json"),
};

/**
 * Deep-merge a locale catalog over English, so a key missing from a translated
 * file (e.g. one added after the last translation run) falls back to English
 * rather than showing the raw key.
 */
function mergeDeep(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const b = out[key];
    if (value && typeof value === "object" && !Array.isArray(value) &&
        b && typeof b === "object" && !Array.isArray(b)) {
      out[key] = mergeDeep(b as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function getMessages(locale: Locale): Promise<Messages> {
  if (locale === DEFAULT_LOCALE || !catalogs[locale]) return en as Messages;
  try {
    const mod = await catalogs[locale]();
    return mergeDeep(en as Messages, mod.default);
  } catch {
    return en as Messages;
  }
}

/** Convenience: the messages + a ready-to-use t() for a server component. */
export async function getTranslations(
  locale: Locale
): Promise<{ messages: Messages; t: TFunction }> {
  const messages = await getMessages(locale);
  return { messages, t: createTranslator(messages) };
}
