"use client";

import { motion } from "framer-motion";
import { LocalizedLink as Link } from "@/i18n/Link";
import { THEMES } from "@/lib/themes";
import { useT } from "@/i18n/I18nProvider";

/**
 * Manifesto-lite: what this is, said plainly, once. Then the five strands.
 * No feature cards, no icons – the promise is restraint, so the section
 * has to embody it.
 */
export function Ethos() {
  const t = useT();
  return (
    <section className="py-24 px-6 border-y border-foreground/10 bg-foreground/[0.025]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="max-w-2xl mx-auto text-center space-y-12"
      >
        <div className="space-y-6">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">
            {t("home.ethos.title")}
          </h2>
          <div className="space-y-4 text-base md:text-lg text-foreground/70 leading-relaxed text-left md:text-center">
            <p>{t("home.ethos.p1")}</p>
            <p>{t("home.ethos.p2")}</p>
          </div>
          <Link
            href="/manifesto"
            className="inline-block text-sm text-foreground/40 hover:text-foreground transition-colors border-b border-transparent hover:border-foreground/40 pb-0.5"
          >
            {t("home.ethos.whyLink")}
          </Link>
        </div>

        {/* The five strands */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-foreground/35">
            {t("home.ethos.strandsLabel")}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {THEMES.map((theme) => (
              <Link
                key={theme.slug}
                href={`/archive?theme=${theme.slug}`}
                className="px-4 py-2 rounded-full border border-foreground/15 text-sm text-foreground/70 hover:border-foreground/50 hover:text-foreground transition-colors"
              >
                {t(`themes.${theme.slug}`)}
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
