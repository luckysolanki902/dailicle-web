"use client";

import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useT } from "@/i18n/I18nProvider";

export default function ManifestoPage() {
  const t = useT();

  // Structured Data for SEO (localized).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("manifesto.meta.title"),
    description: t("manifesto.meta.description"),
    author: { "@type": "Organization", name: "The Dailicle" },
    publisher: {
      "@type": "Organization",
      name: "The Dailicle",
      logo: { "@type": "ImageObject", url: "https://dailicle.com/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://dailicle.com/manifesto" },
    articleBody: `${t("manifesto.p_library")} ${t("manifesto.p_rebellion")}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />

        <article className="max-w-2xl mx-auto px-6 py-32 md:py-40">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-12"
          >
            <header className="space-y-6 text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-serif">
                {t("manifesto.title")}
              </h1>
              <p className="text-lg text-foreground/60 italic font-serif">
                {t("manifesto.subtitle")}
              </p>
            </header>

            <div className="prose prose-lg prose-p:text-foreground/80 prose-headings:text-foreground prose-headings:font-display prose-strong:text-foreground mx-auto font-display leading-relaxed">
              <p>{t("manifesto.p_library")}</p>
              <p>{t("manifesto.p_scroll")}</p>
              <p><strong>{t("manifesto.p_rebellion")}</strong></p>

              <h3>{t("manifesto.h_one")}</h3>
              <p>{t("manifesto.p_one_1")}</p>
              <p>{t("manifesto.p_one_2")}</p>

              <h3>{t("manifesto.h_about")}</h3>
              <p>{t("manifesto.p_about_1")}</p>
              <p>{t("manifesto.p_about_2")}</p>

              <h3>{t("manifesto.h_who")}</h3>
              <p>{t("manifesto.p_who_1")}</p>
              <p>{t("manifesto.p_who_2")}</p>

              <h3>{t("manifesto.h_writes")}</h3>
              <p>{t("manifesto.p_writes")}</p>

              <h3>{t("manifesto.h_recs")}</h3>
              <p>{t("manifesto.p_recs_1")}</p>
              <p>{t("manifesto.p_recs_2")}</p>

              <hr className="border-foreground/10 my-12" />

              <p className="text-center italic text-base">{t("manifesto.closing")}</p>
            </div>
          </motion.div>
        </article>
      </main>
    </>
  );
}
