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
  const title = t("feedback.meta.title");
  const description = t("feedback.meta.description");

  return {
    title,
    description,
    keywords: [
      "feedback",
      "contact",
      "suggestions",
      "user feedback",
      "improve reading experience",
      "essay feedback",
      "content suggestions",
    ],
    openGraph: {
      title,
      description,
      url: localeUrl("/feedback", locale),
      type: "website",
      locale: LOCALES[locale].ogLocale,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: localeUrl("/feedback", locale),
      languages: hreflangAlternates("/feedback"),
    },
    robots: { index: true, follow: true },
  };
}

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
