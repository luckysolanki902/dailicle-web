"use client";

import { motion } from "framer-motion";
import { useT } from "@/i18n/I18nProvider";

interface NextWeekProps {
  topic: {
    title: string;
    themeLabel: string;
    dateLabel: string; // the coming Monday
  } | null;
}

/**
 * The tease. Topic only – the essay doesn't exist yet, and the withheld hook
 * is the point. This block also quietly answers "is this site still alive?":
 * a named topic with a date is a heartbeat.
 */
export function NextWeek({ topic }: NextWeekProps) {
  const t = useT();
  if (!topic) return null;

  return (
    <section className="px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="max-w-xl mx-auto"
      >
        <div className="border border-foreground/10 rounded-2xl px-8 py-7 text-center space-y-3 bg-foreground/[0.03]">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent">
            {t("home.nextWeek.label", { date: topic.dateLabel })}
          </p>
          <h2 className="font-display text-2xl md:text-[1.75rem] leading-snug tracking-tight text-balance">
            {topic.title}
          </h2>
          <p className="text-xs text-foreground/40">{topic.themeLabel}</p>
        </div>
      </motion.div>
    </section>
  );
}
