"use client";

import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// Note: For client components, we'll handle SEO via Next.js metadata in a server wrapper
// or add the metadata export in a layout.tsx for this route
export default function ManifestoPage() {
  // Structured Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Why Read The Dailicle? A Manifesto for the Slow Web",
    "description": "A rebellion against the noise of the internet. The philosophy behind one essay a week.",
    "author": {
      "@type": "Organization",
      "name": "The Dailicle"
    },
    "publisher": {
      "@type": "Organization",
      "name": "The Dailicle",
      "logo": {
        "@type": "ImageObject",
        "url": "https://dailicle.com/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://dailicle.com/manifesto"
    },
    "articleBody": "The internet was supposed to be a library. Instead, it became a casino. The Dailicle is a rebellion against the noise. We publish exactly one essay a week."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <ThemeSwitcher />
      
      <article className="max-w-2xl mx-auto px-6 py-32 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-12"
        >
          <header className="space-y-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-serif">
              Why Read Dailicle?
            </h1>
            <p className="text-lg text-foreground/60 italic font-serif">
              A manifesto for the slow web.
            </p>
          </header>

          <div className="prose prose-lg prose-p:text-foreground/80 prose-headings:text-foreground prose-headings:font-display prose-strong:text-foreground mx-auto font-display leading-relaxed">
            <p>
              The internet was supposed to be a library. Instead, it became a casino.
            </p>
            <p>
              Think about the last hour you spent scrolling. Can you remember one thing from it? The feeds are engineered by some of the smartest people alive to keep your thumb moving, and they are very good at their jobs. What they take is subtle: the evening feels full while the mind stays empty.
            </p>
            <p>
              <strong>The Dailicle is a rebellion against that.</strong>
            </p>

            <h3>The philosophy of one</h3>
            <p>
              We publish exactly one essay a week. Not ten. Not a feed. One, every Monday.
            </p>
            <p>
              Scarcity is a form of respect. When there is only one thing to read, you stop skimming and start reading. You give it your full attention, and we give it a full week of care: each essay is chosen from dozens of candidate ideas, researched properly, and written to be finished. Most take ten to fifteen minutes. There is a narration if you would rather listen.
            </p>

            <h3>What the essays are about</h3>
            <p>
              Five strands: psychology, philosophy, perspectives, life, and money. What connects them is a certain kind of idea — a specific, human observation you half-recognize but have never put into words. The worries you inherited from your parents. Why some days vanish and others last forever. What it quietly costs to keep every option open.
            </p>
            <p>
              A good essay here should still be on your mind on Wednesday.
            </p>

            <h3>Who is this for?</h3>
            <p>
              The curious. People who still believe a well-crafted sentence can change how you see the world, and people who suspect they would read more if reading felt less like homework. There is no signup, no paywall, and nothing to keep track of — one essay, once a week, free.
            </p>
            <p>
              If you want content to fill the silence, plenty of places will happily oblige. If you want ideas that linger after the tab closes, welcome home.
            </p>

            <h3>Who writes it?</h3>
            <p>
              The essays are written and edited at The Dailicle Desk, in one house voice, and held to a single bar: would a careful reader want to read this twice? No bylines chasing attention, no guest posts, no filler weeks.
            </p>

            <h3>Why no recommendations?</h3>
            <p>
              Recommendation algorithms are built for <em>engagement</em>, not <em>enlightenment</em>. We want you to read, think, and then <strong>leave</strong>. Go for a walk. Talk to a friend. Build something.
            </p>
            <p>
              Sometimes an essay ends with a few pointers for anyone who wants to sit with the idea longer. But we will never trap you in a loop.
            </p>

            <hr className="border-foreground/10 my-12" />

            <p className="text-center italic text-base">
              Read slowly. Think deeply. Come back Monday.
            </p>
          </div>
        </motion.div>
      </article>
      </main>
    </>
  );
}
