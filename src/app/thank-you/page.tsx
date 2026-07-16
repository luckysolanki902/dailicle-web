"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

/**
 * Where a reader lands after a successful support payment. Deliberately quiet
 * and warm — a moment of gratitude, not a receipt. Theme-aware via the same CSS
 * variables (--background / --foreground / --accent) the rest of the site uses.
 */
export default function ThankYouPage() {
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.14, delayChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24 text-foreground">
      {/* Soft accent glow behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-lg text-center"
      >
        {/* Beating heart */}
        <motion.div variants={item} className="mb-8 flex justify-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", damping: 12, stiffness: 200 }}
            className="relative flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "color-mix(in srgb, var(--accent) 22%, transparent)",
              }}
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="text-accent"
            >
              <Heart size={34} className="fill-current" />
            </motion.span>
          </motion.span>
        </motion.div>

        <motion.p
          variants={item}
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-accent"
        >
          The Dailicle
        </motion.p>

        <motion.h1
          variants={item}
          className="font-display text-4xl leading-[1.12] tracking-tight text-balance md:text-5xl"
        >
          Thank you, truly.
        </motion.h1>

        <motion.p
          variants={item}
          className="mx-auto mt-6 max-w-md font-serif text-lg leading-relaxed text-foreground/60"
        >
          Because of you, the desk stays lit a little longer. The essays will keep
          arriving every Monday — slow, careful, and free for everyone, exactly as
          they were before.
        </motion.p>

        <motion.p
          variants={item}
          className="mx-auto mt-4 max-w-sm font-serif italic text-foreground/45"
        >
          You didn&apos;t have to. That&apos;s exactly why it means so much.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/"
            className="rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Back home
          </Link>
          <Link
            href="/archive"
            className="text-sm font-medium text-foreground/60 underline decoration-accent/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-accent"
          >
            Read another essay
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
