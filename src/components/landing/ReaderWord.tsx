"use client";

import { motion } from "framer-motion";

/**
 * One real voice. A single genuine sentence from an actual reader's email
 * carries more weight than any invented crowd — and we don't have a crowd
 * to invent, which readers can smell anyway.
 */
export function ReaderWord() {
  return (
    <section className="py-24 px-6">
      <motion.figure
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl mx-auto text-center space-y-6"
      >
        <blockquote className="font-display italic text-2xl md:text-3xl leading-snug text-foreground/80 text-balance">
          &ldquo;I only found this site a few days ago, and it&apos;s absolutely
          incredible&hellip; thank you for publishing such thoughtful,
          thought-provoking articles.&rdquo;
        </blockquote>
        <figcaption className="text-sm text-foreground/40">
          — a reader, by email
        </figcaption>
      </motion.figure>
    </section>
  );
}
