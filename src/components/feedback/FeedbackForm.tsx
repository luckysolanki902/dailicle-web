"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("submitting");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, identity }),
      });

      if (res.ok) {
        track("feedback_submit", { has_identity: !!identity.trim() });
        setStatus("success");
        setMessage("");
        setIdentity("");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center p-8 text-center space-y-4 bg-foreground/5 rounded-2xl"
          >
            <CheckCircle size={48} className="text-green-500" />
            <h3 className="text-xl font-medium">Message Received</h3>
            <p className="text-foreground/60">Thank you for your thoughts.</p>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-foreground/60 ml-1">
                Your Message <span className="text-red-400">*</span>
              </label>
              <textarea
                id="message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind? Feedback, ideas, or just hello."
                className="w-full min-h-[150px] p-4 rounded-2xl bg-foreground/5 border-transparent focus:border-foreground/20 focus:bg-background transition-all outline-none resize-none placeholder:text-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="identity" className="text-sm font-medium text-foreground/60 ml-1">
                Who are you? <span className="text-foreground/30 font-normal">(Optional)</span>
              </label>
              <input
                id="identity"
                type="text"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="Name, Twitter, or Email"
                className="w-full p-4 rounded-xl bg-foreground/5 border-transparent focus:border-foreground/20 focus:bg-background transition-all outline-none placeholder:text-foreground/30"
              />
            </div>

            <button
              type="submit"
              disabled={status === "submitting" || !message.trim()}
              className="w-full py-4 bg-foreground text-background rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {status === "submitting" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Send Message</span>
                  <Send size={16} />
                </>
              )}
            </button>
            
            {status === "error" && (
              <p className="text-red-500 text-sm text-center">
                Something went wrong. Please try again.
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
