"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The unsubscribe form. Email arrives one of two ways: prefilled from the
 * `?email=` the link in a Dailicle email carries, or typed by someone who got
 * here on their own. Either way it stays editable and needs one deliberate
 * click — a link that unsubscribes on load would let any inbox scanner that
 * prefetches URLs drop a reader without them ever deciding to leave.
 */
export function UnsubscribeForm() {
  const t = useT();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  useEffect(() => {
    const fromLink = searchParams.get("email");
    if (fromLink) setEmail(fromLink.trim().toLowerCase());
  }, [searchParams]);

  const valid = emailPattern.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    setStatus("submitting");

    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center p-8 text-center space-y-4 bg-foreground/5 rounded-2xl"
          >
            <CheckCircle size={48} className="text-accent" />
            <h3 className="text-xl font-medium">{t("unsubscribe.form.successTitle")}</h3>
            <p className="text-foreground/60">{t("unsubscribe.form.successBody")}</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground/60 ml-1">
                {t("unsubscribe.form.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("unsubscribe.form.emailPlaceholder")}
                className="w-full p-4 rounded-xl bg-foreground/5 border-transparent focus:border-accent/60 focus:bg-background transition-all outline-none placeholder:text-foreground/30"
              />
            </div>

            <button
              type="submit"
              disabled={status === "submitting" || !valid}
              className="w-full py-4 bg-foreground text-background rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {status === "submitting" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <span>{t("unsubscribe.form.submit")}</span>
              )}
            </button>

            {status === "error" && (
              <p className="text-red-500 text-sm text-center">{t("unsubscribe.form.error")}</p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
