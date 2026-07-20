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
  const title = t("manifesto.meta.title");
  const description = t("manifesto.meta.description");

  return {
    title,
    description,
    keywords: [
      "slow web manifesto",
      "digital wellbeing",
      "mindful reading",
      "anti-doomscrolling",
      "distraction-free reading",
      "philosophy of reading",
      "deep work",
      "intentional content consumption",
      "scarcity creates value",
      "reading philosophy",
    ],
    openGraph: {
      title,
      description,
      url: localeUrl("/manifesto", locale),
      type: "article",
      locale: LOCALES[locale].ogLocale,
      images: [
        { url: "/og-manifesto.png", width: 1200, height: 630, alt: "The Dailicle Manifesto - The Slow Web" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-manifesto.png"],
    },
    alternates: {
      canonical: localeUrl("/manifesto", locale),
      languages: hreflangAlternates("/manifesto"),
    },
  };
}

export default function ManifestoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
