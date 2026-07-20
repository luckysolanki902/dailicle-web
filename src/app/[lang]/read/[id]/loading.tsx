"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { BookText, Sparkles } from "lucide-react";

export default function Loading() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 px-6"
      >
        {/* Animated Reading Icon */}
        <motion.div
          animate={{ 
            rotate: [0, 5, -5, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative"
        >
          <BookText size={64} className="text-foreground" strokeWidth={1.5} />
          <motion.div
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.5, 0.2, 0.5]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles size={20} className="text-yellow-500" />
          </motion.div>
        </motion.div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <motion.h2
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-2xl md:text-3xl font-bold text-foreground"
          >
            Preparing your essay...
          </motion.h2>
          <p className="text-sm text-foreground/50">
            Setting up the perfect reading environment
          </p>
        </div>

        {/* Animated Dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ 
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
              className="w-2 h-2 rounded-full bg-foreground/40"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
