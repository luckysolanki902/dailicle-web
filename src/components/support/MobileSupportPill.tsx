"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useSupport } from "./SupportProvider";
import { useT } from "@/i18n/I18nProvider";

/**
 * A support affordance for phones.
 *
 * The navbar is `hidden md:block`, so below that breakpoint the only way to
 * support was the footer — which meant most readers never saw one at all.
 * "Nobody clicks the navbar" was partly "there is no navbar to click".
 *
 * It cannot simply be the navbar unhidden: the reader page has its own in-flow
 * top bar (back link, language, type size, share), and a fixed element in the
 * top corners would sit on top of it. So this lives at the bottom instead,
 * where nothing else is, and within thumb reach.
 *
 * It stays out of the way until the reader has actually got somewhere — no
 * affordance on a page they just landed on — and never appears for someone who
 * has already given.
 */

/** How far down the page before it's worth asking. */
const SHOW_AFTER = 0.35;

export function MobileSupportPill() {
  const { open, isOpen, hasSupported } = useSupport();
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasSupported) return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // A page too short to scroll has no "further in" to reach.
      if (scrollable < 400) return setVisible(false);
      setVisible(window.scrollY / scrollable >= SHOW_AFTER);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [hasSupported]);

  if (hasSupported) return null;

  return (
    <AnimatePresence>
      {visible && !isOpen && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={() => open("navbar")}
          aria-label={t("nav.support")}
          className={
            // Deliberately echoes the ThemeSwitcher's shape and blur so it
            // reads as part of the furniture rather than an ad.
            "fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full " +
            "border border-black/5 bg-black/5 px-4 py-2.5 text-[13px] font-medium " +
            "text-accent shadow-sm backdrop-blur-lg transition-colors " +
            "dark:border-white/10 dark:bg-white/10 md:hidden"
          }
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        >
          <Heart size={13} className="fill-current" />
          <span>{t("nav.support")}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
