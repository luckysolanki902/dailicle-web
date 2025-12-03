"use client";

import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { Mail } from "lucide-react";

export default function FeedbackPage() {
  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />
      
      <div className="max-w-2xl mx-auto px-6 py-32 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-12"
        >
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight">Feedback</h1>
            <p className="text-lg text-foreground/60">
              Help us shape the future of Dailicle.
            </p>
          </header>

          <FeedbackForm />

          <div className="pt-12 text-center space-y-4">
            <p className="text-sm text-foreground/40">
              Prefer email? Reach out directly:
            </p>
            <a 
              href="mailto:luckysolanki902@gmail.com"
              className="inline-flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              <Mail size={16} />
              luckysolanki902@gmail.com
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
