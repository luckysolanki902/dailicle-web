"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { createTranslator, type Messages, type TFunction } from "@/i18n/translator";

interface I18nValue {
  locale: Locale;
  t: TFunction;
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: (key: string) => key,
});

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: createTranslator(messages) }),
    [locale, messages]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client-side translations + current locale. */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Shorthand for the common case: const t = useT(). */
export function useT(): TFunction {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
