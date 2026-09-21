"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

type Resolved =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "ready"; email: string; alreadyUnsubscribed: boolean };

/**
 * The unsubscribe confirmation. There is no address field on purpose: the
 * subscriber is identified by the opaque token in the link we emailed, so
 * nobody can unsubscribe an address that isn't theirs.
 *
 * It still takes one click. Mail-security scanners fetch every URL in an email
 * before it reaches the inbox, so unsubscribing on load would quietly drop
 * readers who never chose to leave.
 */
export function UnsubscribeConfirm() {
  const t = useT();
  const searchParams = useSearchParams();
  const token = searchParams.get("t")?.trim() ?? "";
  const [resolved, setResolved] = useState<Resolved>({ state: "loading" });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  useEffect(() => {
    if (!token) {
      setResolved({ state: "invalid" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        setResolved(
          data?.valid
            ? {
                state: "ready",
                email: data.email as string,
                alreadyUnsubscribed: !!data.alreadyUnsubscribed,
              }
            : { state: "invalid" }
        );
      } catch {
        if (!cancelled) setResolved({ state: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleUnsubscribe = async () => {
    setStatus("submitting");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (resolved.state === "loading") {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="animate-spin text-foreground/30" />
      </div>
    );
  }

  if (resolved.state === "invalid") {
    return (
      <div className="w-full max-w-md mx-auto p-8 text-center space-y-3 bg-foreground/5 rounded-2xl">
        <h3 className="text-xl font-medium">{t("unsubscribe.invalid.title")}</h3>
        <p className="text-foreground/60">{t("unsubscribe.invalid.body")}</p>
        <a
          href="mailto:read@dailicle.com"
          className="inline-block pt-2 text-accent hover:underline"
        >
          read@dailicle.com
        </a>
      </div>
    );
  }

  const done = status === "success" || resolved.alreadyUnsubscribed;

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {done ? (
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
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="p-4 text-center rounded-xl bg-foreground/5">
              <p className="text-sm text-foreground/50">{t("unsubscribe.form.addressLabel")}</p>
              <p className="pt-1 font-medium tracking-wide">{resolved.email}</p>
            </div>

            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={status === "submitting"}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
