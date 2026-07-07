"use client";

import { motion } from "framer-motion";

/**
 * Real voices. Genuine sentences from actual readers' emails carry more
 * weight than any invented crowd – and we don't have a crowd to invent,
 * which readers can smell anyway. So: no star ratings, no headshots, no
 * section title. Just the letters, more or less as they arrived.
 */
interface ReaderNote {
  quote: string;
  /** Optional essay this reader was writing about. */
  essay?: string;
  attribution: string;
}

const NOTES: ReaderNote[] = [
  {
    quote:
      "Just read this and want to thank you for this essay. It gives me a lot to think about – and to talk about with my girlfriend. Looking forward to next week.",
    essay: "The Fear of Dying Before You Become Yourself",
    attribution: "Germany",
    // Michael, Münster, 
  },
  {
    quote:
      "I only found this site a few days ago, and it’s absolutely incredible. Thank you so much for building this platform and publishing such thoughtful, thought-provoking articles.",
    attribution: "China",
    // Su Yang,
  },
];

export function ReaderWord() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          {NOTES.map((note, i) => (
            <motion.figure
              key={note.attribution}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.12 }}
              className="relative flex h-full flex-col rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-8 md:p-9"
            >
              <span
                aria-hidden
                className="font-display absolute left-6 top-3 select-none text-5xl leading-none text-foreground/10"
              >
                &ldquo;
              </span>

              <blockquote className="font-display relative italic text-xl md:text-2xl leading-snug text-foreground/80 text-balance">
                {note.quote}
              </blockquote>

              <figcaption className="mt-6 space-y-1 border-t border-foreground/10 pt-4 text-sm">
                <span className="block text-foreground/50">– {note.attribution}</span>
                {note.essay && (
                  <span className="block text-xs italic text-foreground/35">
                    on &ldquo;{note.essay}&rdquo;
                  </span>
                )}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
