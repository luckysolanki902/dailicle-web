import type { Metadata } from "next";
import { getTranslations } from "@/i18n/getMessages";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  localeUrl,
  hreflangAlternates,
  type Locale,
} from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const { t } = await getTranslations(locale);
  const title = t("unsubscribe.meta.title");
  const description = t("unsubscribe.meta.description");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: localeUrl("/unsubscribe", locale),
      type: "website",
      locale: LOCALES[locale].ogLocale,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: localeUrl("/unsubscribe", locale),
      languages: hreflangAlternates("/unsubscribe"),
    },
    // Reached from a link in an email, never from a search. Indexing it would
    // only put "unsubscribe" in front of people who hadn't asked to leave.
    robots: { index: false, follow: false },
  };
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
