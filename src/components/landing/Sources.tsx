"use client";

import { motion } from "framer-motion";

export function Sources() {
  return (
    <section className="py-24 px-6 border-y border-foreground/10 bg-foreground/5">
      <div className="max-w-5xl mx-auto text-center space-y-10">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-foreground/50">
            Powered by research from
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground/80">World-Class Sources</h3>
        </div>
        
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {["Paul Graham", "arXiv.org", "Harvard Business Review", "Nature", "First Round Review", "Famous Books"].map((source, i) => (
              <motion.span 
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-xl md:text-2xl font-serif font-medium text-foreground"
              >
                {source}
              </motion.span>
            ))}
          </div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-xs text-foreground/30 font-medium max-w-md mx-auto"
          >
            And other trusted research papers, essays, and blogs.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
