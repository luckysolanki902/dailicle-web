"use client";

import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import type { Metadata } from "next";

// Note: For client components, we'll handle SEO via Next.js metadata in a server wrapper
// or add the metadata export in a layout.tsx for this route
export default function ManifestoPage() {
  // Structured Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Why Read Dailicle? A Manifesto for the Slow Web",
    "description": "A rebellion against the noise of the internet. The philosophy behind one essay per day.",
    "author": {
      "@type": "Person",
      "name": "Lucky Solanki"
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
    "articleBody": "The internet was supposed to be a library. Instead, it became a casino. Dailicle is a rebellion against the noise. We publish exactly one essay per day."
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

          <div className="prose prose-lg prose-p:text-foreground/80 prose-headings:text-foreground prose-strong:text-foreground mx-auto font-serif leading-relaxed">
            <p>
              The internet was supposed to be a library. Instead, it became a casino.
            </p>
            <p>
              Every day, you are bombarded with infinite scrolls, algorithmic feeds, and clickbait designed to hijack your dopamine receptors. The result is a fragmented mind. We know more, but understand less. We consume more, but taste less.
            </p>
            <p>
              <strong>Dailicle is a rebellion against the noise.</strong>
            </p>
            
            <h3>The Philosophy of One</h3>
            <p>
              We publish exactly one essay per day. Not ten. Not a feed. Just one.
            </p>
            <p>
              Why? Because scarcity creates value. When you know there is only one thing to read, you stop skimming and start reading. You give it your full attention. And in return, we give you our best work.
            </p>

            <h3>Who is this for?</h3>
            <p>
              It is for the curious. For the people who still believe that a well-crafted sentence can change the way you see the world. It is for the builders, the thinkers, and the dreamers who are tired of the shallow waters of social media and want to dive deep.
            </p>
            <p>
              If you are looking for &quot;content&quot; to fill the silence, this is not for you. But if you are looking for ideas that will linger in your mind long after you close the tab, welcome home.
            </p>

            <h3>Why No Recommendations?</h3>
            <p>
              Recommendation algorithms are designed to keep you on the platform. They are designed for <em>engagement</em>, not <em>enlightenment</em>. We want you to read, think, and then <strong>leave</strong>. Go for a walk. Talk to a friend. Build something.
            </p>
            <p>
              We give you the raw sources at the bottom of every essay for those who want to go deeper. But we will never trap you in a loop.
            </p>

            <hr className="border-foreground/10 my-12" />

            <p className="text-center italic text-base">
              Read slowly. Think deeply.
            </p>
          </div>
        </motion.div>
      </article>
      </main>
    </>
  );
}
