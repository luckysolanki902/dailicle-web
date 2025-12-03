"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles, Clock, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Video vs. Text",
    description: "A 1-hour video podcast often contains 10 minutes of actual insight. We give you the signal without the noise. Read faster, learn deeper."
  },
  {
    icon: Clock,
    title: "Respects Your Time",
    description: "One essay a day. Delivered at 9 AM. No infinite scroll, no doomscrolling loops. Just 25 minutes of high-signal reading."
  },
  {
    icon: Sparkles,
    title: "Curated Wisdom",
    description: "We don't chase trends. We chase timeless ideas that upgrade your mental models and decision-making frameworks."
  },
  {
    icon: ShieldCheck,
    title: "Zero Noise",
    description: "No ads. No paywalls. No clickbait. Just a clean, beautiful reading experience designed for focus."
  }
];

export function ValueProps() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 space-y-5">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Why The Dailicle?
          </h2>
          <p className="text-xl md:text-2xl text-foreground/70 max-w-2xl mx-auto leading-relaxed">
            In an age of information abundance, <br className="hidden md:block" />
            <strong className="text-foreground">attention is the scarcest resource.</strong>
          </p>
          <p className="text-base text-foreground/50 max-w-xl mx-auto">
            We protect yours. No signups, no tracking, no bullshit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-8 rounded-2xl bg-foreground/5 border border-foreground/10 hover:border-foreground/20 transition-all hover:shadow-lg"
            >
              <div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center mb-6 text-foreground group-hover:scale-110 transition-transform">
                <feature.icon size={26} strokeWidth={2} />
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3">{feature.title}</h3>
              <p className="text-foreground/70 leading-relaxed text-base">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
