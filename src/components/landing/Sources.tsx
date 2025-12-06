"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function Sources() {
  const sources = [
    "Paul Graham Essays",
    "Sam Altman Blog", 
    "arXiv.org",
    "Farnam Street",
    "Wait But Why",
    "Harvard Business Review",
    "Nature Journal",
    "First Round Review",
    "James Clear",
    "Derek Sivers",
    "Cal Newport"
  ];

  const books = [
    "Thinking, Fast and Slow",
    "The Lean Startup", 
    "Sapiens",
    "Atomic Habits",
    "Zero to One",
    "The Mom Test",
    "Deep Work",
    "Hooked",
    "The Power of Habit",
    "Meditations",
    "Grit",
    "The Hard Thing About Hard Things"
  ];

  return (
    <section className="py-24 px-6 border-y border-foreground/10 bg-foreground/5">
      <div className="max-w-5xl mx-auto text-center space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles size={16} className="text-foreground/40" />
            <p className="text-xs font-bold uppercase tracking-widest text-foreground/50">
              Curated by OpenAI Deep Research
            </p>
            <Sparkles size={16} className="text-foreground/40" />
          </div>
          <h3 className="text-3xl md:text-4xl font-bold text-foreground">
            A well-researched essay every day at 9 AM sharp
          </h3>
          <p className="text-base md:text-lg text-foreground/60 max-w-2xl mx-auto">
            Synthesized from world-class essayists, bloggers, research papers, and popular books
          </p>
        </div>

        {/* Sources Grid */}
        <div className="space-y-10">
          {/* Essayists & Bloggers */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
              Including essays & blogs from
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
              {sources.map((source, i) => (
                <motion.span 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="text-sm md:text-base font-medium text-foreground"
                >
                  {source}
                </motion.span>
              ))}
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: sources.length * 0.05 }}
                className="text-sm md:text-base font-medium text-foreground/50"
              >
                + many more
              </motion.span>
            </div>
          </div>

          {/* Books */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
              Insights from books like
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
              {books.map((book, i) => (
                <motion.span 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="text-sm md:text-base font-serif italic text-foreground"
                >
                  {book}
                </motion.span>
              ))}
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: books.length * 0.05 }}
                className="text-sm md:text-base font-serif italic text-foreground/50"
              >
                + hundreds more
              </motion.span>
            </div>
          </div>
        </div>
        
      </div>
    </section>
  );
}
