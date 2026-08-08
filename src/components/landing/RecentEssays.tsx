"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { LocalizedLink as Link } from "@/i18n/Link";
import { useT } from "@/i18n/I18nProvider";

export interface EssayCard {
  href: string;
  title: string;
  hook: string;
  themeLabel: string;
  readingMinutes: number;
}

interface RecentEssaysProps {
  /** Ranked by likes. Rendered first — the best case for reading on. */
  popular: EssayCard[];
  essays: EssayCard[];
}

/** One row. Extracted so both groups stay identical as the card evolves. */
function EssayRow({ essay, index }: { essay: EssayCard; index: number }) {
  const t = useT();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
    >
      <Link
        href={essay.href}
        className="group block px-7 py-6 rounded-2xl border border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03] transition-colors"
      >
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-2">
          <span className="text-accent">{essay.themeLabel}</span>
          <span className="text-foreground/40 font-medium">
            {" · "}
            {t("home.recent.minutes", { minutes: essay.readingMinutes })}
          </span>
        </p>
        <h3 className="font-display text-xl md:text-[1.35rem] leading-snug tracking-tight group-hover:underline decoration-foreground/25 underline-offset-4">
          {essay.title}
        </h3>
        {essay.hook && (
          <p className="mt-2 text-sm text-foreground/55 leading-relaxed line-clamp-2">
            {essay.hook}
          </p>
        )}
      </Link>
    </motion.div>
  );
}

/** A small caps label above a group, matching the masthead's register. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-foreground/40 mb-3 pl-1">
      {children}
    </p>
  );
}

/**
 * Depth is proof. A few real titles do the persuading that feature cards can't.
 *
 * Two groups, because they answer different questions: what everyone else found
 * worth reading, and what has just gone out. Popularity comes from likes, but
 * only ever as an *order* — printing counts next to a title would turn the
 * reaction bar's private nudge into a scoreboard (see lib/reactions).
 */
export function RecentEssays({ popular, essays }: RecentEssaysProps) {
  const t = useT();
  if (popular.length === 0 && essays.length === 0) return null;

  return (
    <section className="py-24 px-6">
      <div className="max-w-2xl mx-auto space-y-10">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="font-display text-3xl tracking-tight text-center"
        >
          {t("home.recent.title")}
        </motion.h2>

        {popular.length > 0 && (
          <div>
            <GroupLabel>{t("home.recent.popularLabel")}</GroupLabel>
            <div className="space-y-3">
              {popular.map((essay, i) => (
                <EssayRow key={essay.href} essay={essay} index={i} />
              ))}
            </div>
          </div>
        )}

        {essays.length > 0 && (
          <div>
            <GroupLabel>{t("home.recent.recentLabel")}</GroupLabel>
            <div className="space-y-3">
              {essays.map((essay, i) => (
                <EssayRow key={essay.href} essay={essay} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* The way out of the section. It was a grey text link before and read
            as a caption, so nobody found the archive from here. */}
        <div className="text-center pt-2">
          <Link
            href="/archive"
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full border border-foreground/25 text-sm md:text-base font-medium text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/10"
          >
            <span>{t("home.recent.browseAll")}</span>
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
