"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export interface EssayCard {
  href: string;
  title: string;
  hook: string;
  themeLabel: string;
  readingMinutes: number;
}

interface RecentEssaysProps {
  essays: EssayCard[];
}

/**
 * Depth is proof. A few real titles do the persuading that feature
 * cards can't — and the 2025 collection keeps the shelf from looking bare.
 */
export function RecentEssays({ essays }: RecentEssaysProps) {
  if (essays.length === 0) return null;

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
          Keep reading
        </motion.h2>

        <div className="space-y-3">
          {essays.map((essay, i) => (
            <motion.div
              key={essay.href}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
            >
              <Link
                href={essay.href}
                className="group block px-7 py-6 rounded-2xl border border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03] transition-colors"
              >
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-2">
                  <span className="text-accent">{essay.themeLabel}</span>
                  <span className="text-foreground/40 font-medium">
                    {" · "}
                    {essay.readingMinutes} min
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
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/archive"
            className="group inline-flex items-center gap-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
          >
            <span>Browse all the essays</span>
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
