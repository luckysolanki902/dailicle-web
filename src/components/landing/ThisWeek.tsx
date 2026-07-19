"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { ParallaxBanner } from "@/components/ui/ParallaxBanner";

interface ThisWeekProps {
  essay: {
    href: string;
    title: string;
    hook: string;
    themeLabel: string;
    issue?: number | null;
    dateLabel: string;
    readingMinutes: number;
    bannerUrl?: string | null;
  } | null;
  /** Shown when nothing is published yet: tease the first issue instead. */
  upcoming?: {
    title: string;
    themeLabel: string;
    dateLabel: string;
  } | null;
}

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The hero, as a front page. Newspaper masthead up top, then the essay
 * itself as the loudest element – people decide to read from a title and
 * a hook, never from a feature grid. One action, zero friction.
 */
export function ThisWeek({ essay, upcoming }: ThisWeekProps) {
  return (
    <section className="relative min-h-[96vh] flex flex-col items-center px-6 overflow-hidden">
      {/* Accent-tinted glow from the top, like light on a desk */}
      <div className="absolute inset-0 hero-glow pointer-events-none" aria-hidden />

      {/* Masthead */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="w-full max-w-3xl pt-14 md:pt-16 text-center space-y-4 z-10"
      >
        <div className="rule-fade h-px w-full" aria-hidden />
        <div className="space-y-1.5 py-1">
          <p className="font-display text-2xl md:text-[1.7rem] tracking-[0.08em] uppercase">
            The Dailicle
          </p>
          <p className="text-[11px] tracking-[0.28em] uppercase text-foreground/45">
            One essay a week &middot; read slowly
          </p>
        </div>
        <div className="rule-fade h-px w-full" aria-hidden />
      </motion.header>

      {/* Full-bleed banner illustration, woven into the page */}
      {essay?.bannerUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease }}
          className="relative left-1/2 z-0 mt-6 w-screen -translate-x-1/2 md:mt-8"
        >
          <ParallaxBanner src={essay.bannerUrl} alt={essay.title} />
        </motion.div>
      )}

      {/* The essay */}
      <div className="flex-1 flex items-center w-full z-10">
        <div className="max-w-3xl mx-auto w-full text-center space-y-9 py-16">
          {essay ? (
            <>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-xs font-semibold tracking-[0.22em] uppercase text-accent"
              >
                {essay.issue ? `Issue ${essay.issue}` : "This week"}
                <span className="text-foreground/35 font-medium">
                  {"  ·  "}
                  {essay.themeLabel}
                  {"  ·  "}
                  {essay.dateLabel}
                </span>
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.35, ease }}
                className="font-display text-[2.6rem] md:text-6xl lg:text-[4.4rem] leading-[1.06] tracking-tight text-balance"
              >
                {essay.title}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.55 }}
                className="space-y-7"
              >
                <p className="font-display italic text-lg md:text-[1.35rem] text-foreground/65 max-w-xl mx-auto leading-relaxed text-balance">
                  {essay.hook}
                </p>

                {/* fleuron */}
                <div
                  className="text-accent/70 text-sm tracking-[0.6em] select-none"
                  aria-hidden
                >
                  ❧
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.75, ease }}
                className="flex flex-col items-center gap-4"
              >
                <Link
                  href={essay.href}
                  className="group inline-flex items-center gap-3 px-9 py-4 bg-foreground text-background rounded-full text-base md:text-lg font-medium shadow-lg shadow-foreground/10 transition-all duration-300 hover:shadow-xl hover:shadow-foreground/20 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Read this week&apos;s essay</span>
                  <ArrowRight
                    size={19}
                    className="transition-transform duration-300 group-hover:translate-x-1.5"
                  />
                </Link>
                <p className="text-xs text-foreground/45">
                  {essay.readingMinutes} min read · free · nothing to sign up for
                </p>
                <Link
                  href="/archive"
                  className="mt-2 text-sm text-foreground/40 hover:text-foreground transition-colors border-b border-transparent hover:border-foreground/40 pb-0.5"
                >
                  or start in the archive
                </Link>
              </motion.div>
            </>
          ) : (
            /* Launch state: nothing published yet – tease the first issue */
            <>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-xs font-semibold tracking-[0.22em] uppercase text-accent"
              >
                {upcoming
                  ? `First issue · ${upcoming.themeLabel} · arriving ${upcoming.dateLabel}`
                  : "Between issues"}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.35, ease }}
                className="font-display text-[2.4rem] md:text-6xl leading-[1.06] tracking-tight text-balance"
              >
                {upcoming ? upcoming.title : "The next essay is on its way."}
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Link
                  href="/archive"
                  className="group inline-flex items-center gap-3 px-9 py-4 bg-foreground text-background rounded-full text-base font-medium shadow-lg shadow-foreground/10 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                >
                  <span>Browse the archive while you wait</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-300 group-hover:translate-x-1.5"
                  />
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="pb-8 z-10 text-foreground/30"
        aria-hidden
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </motion.div>
    </section>
  );
}
