"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { track } from "@/lib/analytics";
import { SubscribeForm } from "@/components/reader/SubscribeForm";

const DISMISS_KEY = "dailicle:nudgeDismissed";
const SUBSCRIBED_KEY = "dailicle:subscribed";

/**
 * A subtle, dismissible subscribe bar that slides up once the reader is ~halfway
 * through — the moment the essay has started to land. Deliberately not a modal
 * (no scrim, no interruption): the doc warns mid-read modals breed resentment.
 * It hides near the very bottom so it never competes with the end-of-essay box,
 * and it remembers a dismissal or a signup so it asks at most once.
 */
export function ScrollSubscribeNudge({ source = "reader_inline" }: { source?: string }) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [gone, setGone] = useState(true); // start hidden; enabled after mount check

  useEffect(() => {
    try {
      if (
        localStorage.getItem(DISMISS_KEY) === "1" ||
        localStorage.getItem(SUBSCRIBED_KEY) === "1"
      ) {
        return; // stays gone
      }
    } catch {
      /* ignore */
    }
    setGone(false);

    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
      // Show past the halfway mark, but step aside for the end-of-essay box.
      setVisible(pct >= 50 && pct < 88);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (visible) track("subscribe_nudge_shown", { source });
    // fire once per appearance is fine; low volume
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (gone) return null;

  const dismiss = () => {
    setVisible(false);
    setGone(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    track("subscribe_nudge_dismiss", { source });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", damping: 26, stiffness: 260 }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4"
        >
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-foreground/10 bg-background/90 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur">
            <p className="hidden shrink-0 text-sm text-foreground/70 sm:block">
              {t("reader.subscribe.nudge")}
            </p>
            <div className="min-w-0 flex-1">
              <SubscribeForm source={source} compact />
            </div>
            <button
              onClick={dismiss}
              aria-label={t("common.dismiss")}
              className="shrink-0 rounded-full p-1 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
