"use client";

import { motion } from "framer-motion";

/**
 * Where the desk is read. A quiet, ranked bar chart no numbers, just the
 * ordering and relative bar lengths, so a glance tells you who reads most and
 * least. Bars use a perceptual (sqrt) scale of each country's share: strictly
 * order-preserving, but it keeps the long tail visible instead of collapsing
 * every country after the US into an invisible sliver. Theme-based via --accent.
 */
interface Country {
  name: string;
  flag: string;
  /** Share of readers, in percent. Only the *ordering* and *ratios* show. */
  share: number;
}

// Top readerships, already sorted high → low.
const COUNTRIES: Country[] = [
  { name: "United States", flag: "🇺🇸", share: 41.1 },
  { name: "United Kingdom", flag: "🇬🇧", share: 6.42 },
  { name: "Germany", flag: "🇩🇪", share: 5.48 },
  { name: "India", flag: "🇮🇳", share: 5.13 },
  { name: "Canada", flag: "🇨🇦", share: 4.35 },
  { name: "Netherlands", flag: "🇳🇱", share: 2.92 },
  { name: "Switzerland", flag: "🇨🇭", share: 2.84 },
  { name: "France", flag: "🇫🇷", share: 2.33 },
  { name: "Italy", flag: "🇮🇹", share: 2.06 },
  { name: "Sweden", flag: "🇸🇪", share: 1.94 },
  { name: "Saudi Arabia", flag: "🇸🇦", share: 1.79 },
  { name: "Spain", flag: "🇪🇸", share: 1.48 },
];

const MAX = COUNTRIES[0].share;

/** Perceptual width in %, order-preserving, with a floor so bars stay visible. */
function barWidth(share: number): number {
  return Math.max(7, Math.round(Math.sqrt(share / MAX) * 100));
}

export function ReadersByCountry() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Read around the world
          </p>
          <h2 className="mt-3 font-display text-2xl tracking-tight text-balance md:text-3xl">
            Quietly, in more places than you&apos;d think
          </h2>
        </div>

        <div className="space-y-3">
          {COUNTRIES.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className="flex items-center gap-3 sm:gap-4"
            >
              <span aria-hidden className="w-5 text-center text-base leading-none">
                {c.flag}
              </span>
              <span className="w-24 shrink-0 truncate text-sm text-foreground/60 sm:w-32">
                {c.name}
              </span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, color-mix(in srgb, var(--accent) 45%, transparent), var(--accent))",
                  }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${barWidth(c.share)}%` }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 1, delay: 0.1 + i * 0.05, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs italic text-foreground/35">
          and quiet readers in dozens more countries.
        </p>
      </div>
    </section>
  );
}
