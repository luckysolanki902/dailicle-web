"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Clock, AlertTriangle, Sparkles, BookOpen, BrainCircuit } from "lucide-react";
import Link from "next/link";

interface HeroProps {
  todayTopic: {
    title: string;
    teaser: string;
    readTime: number;
    id: string;
  };
}

export function Hero({ todayTopic }: HeroProps) {
  const [showWarning, setShowWarning] = useState(false);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden pt-8 md:pt-20 pb-10">
      
      {/* Background Elements (Subtle) */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-full h-64 bg-linear-to-b from-foreground/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-64 bg-linear-to-t from-foreground/5 to-transparent" />
      </div>

      <div className="max-w-5xl w-full text-center z-10 space-y-8 md:space-y-12">
        
        {/* Brand Story / Value Prop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <div className="text-center space-y-3">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              The Dailicle
            </h1>
            <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-medium text-foreground/50">
              <Sparkles size={12} className="text-yellow-500" />
              <span>Daily at 9 AM IST</span>
              <span className="mx-1">•</span>
              <span>No signup required</span>
            </div>
          </div>
          
          <h2 className="text-xl md:text-2xl font-medium text-foreground/70 max-w-2xl leading-relaxed">
            The antidote to doomscrolling.
            <br />
            <span className="text-sm md:text-base text-foreground/50">
              One transformative essay each day - distilled from philosophy, psychology, and startup wisdom. 
              For curious minds, ambitious builders, and anyone seeking insights from the greatest thinkers.
            </span>
          </h2>
        </motion.div>

        {/* Main Title Area (The "Hook") */}
        <div className="space-y-6 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative inline-block"
          >
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest uppercase text-foreground/40">
              Today&apos;s Read
            </span>
            <h1 className="text-3xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance leading-tight md:leading-[1.1] max-w-4xl mx-auto">
              {todayTopic.title}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-2xl text-foreground/70 max-w-2xl mx-auto leading-relaxed text-balance font-serif italic"
          >
            &quot;{todayTopic.teaser}&quot;
          </motion.p>
        </div>

        {/* Credibility / Social Proof */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-4 md:gap-8 text-xs md:text-sm text-foreground/40 font-medium"
        >
          <div className="flex items-center gap-2">
            <BrainCircuit size={16} />
            <span>Synthesized from 100+ papers</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen size={16} />
            <span>Inspired by Paul Graham & Naval</span>
          </div>
        </motion.div>

        {/* Action Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col items-center gap-6 pt-4"
        >
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setShowWarning(true)}
              className="group relative inline-flex items-center gap-3 px-10 py-5 bg-foreground text-background rounded-full text-lg md:text-xl font-semibold transition-all hover:scale-105 hover:shadow-2xl active:scale-95 shadow-lg"
            >
              <span>Read Today&apos;s Essay</span>
              <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
            </button>
            <p className="text-xs text-foreground/40 font-medium">No signup • No email • Just read</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-sm text-foreground/50">
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{todayTopic.readTime} min read</span>
            </div>
            <span className="text-foreground/30">•</span>
            <span className="font-medium">Free forever</span>
            <span className="text-foreground/30">•</span>
            <span className="font-medium">No ads</span>
          </div>

          <Link 
            href="/archive"
            className="mt-8 text-sm text-foreground/40 hover:text-foreground transition-colors border-b border-transparent hover:border-foreground pb-0.5"
          >
            Browse the Archive →
          </Link>
        </motion.div>
      </div>

      {/* The "Curious Egoistic Warning" Modal */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border border-foreground/10 shadow-2xl max-w-md w-full p-8 rounded-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center text-foreground">
                  <AlertTriangle size={24} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Are you sure?</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    This essay is not for skimmers. It requires <strong>{todayTopic.readTime} minutes</strong> of deep focus. 
                    <br/><br/>
                    Most people won&apos;t finish it. Proceed only if you are ready to think.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-3 pt-2">
                  <Link 
                    href={`/read/${todayTopic.id}`}
                    className="w-full py-3 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Lock size={16} />
                    I accept the challenge
                  </Link>
                  <button 
                    onClick={() => setShowWarning(false)}
                    className="w-full py-3 text-foreground/50 hover:text-foreground transition-colors text-sm"
                  >
                    No, I&apos;m too busy
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
