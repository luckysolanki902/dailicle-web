"use client";

import { useEffect, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/i18n/Link";
import { useT } from "@/i18n/I18nProvider";
import { getVisitCount, track } from "@/lib/analytics";
import { journeyEvent } from "@/lib/journey";
import { useSupport } from "./SupportProvider";

const DISMISS_KEY = "dailicle:supportCardDismissedUntil";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function EssaySupportCard({ essayId, title }: { essayId: string; title: string }) {
  const t = useT();
  const { open, hasSupported } = useSupport();
  const [dismissed, setDismissed] = useState(false);
  const [returning, setReturning] = useState(false);
  const [ready, setReady] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setDismissed(Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now());
        setReturning(getVisitCount() > 1);
      } catch { /* private browsing can disable storage */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || dismissed || hasSupported || !card.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || seen.current) return;
      seen.current = true;
      track("support_card_view", { essay_id: essayId, placement: "essay_end" });
      journeyEvent("support_card_view", { essayId, title, source: "essay_end" });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [ready, dismissed, hasSupported, essayId, title]);

  if (!ready || dismissed || hasSupported) return null;

  return (
    <div ref={card} className="rounded-3xl border border-accent/25 bg-accent/[0.05] px-6 py-7 sm:px-9">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {t("support.cardEyebrow")}
      </p>
      <h2 className="mt-3 font-display text-2xl leading-snug tracking-tight">
        {returning ? t("support.cardReturningTitle") : t("support.cardTitle")}
      </h2>
      <p className="mt-2 font-serif text-[15px] leading-relaxed text-foreground/65">
        {t("support.cardBody")}
      </p>
      <p className="mt-2 text-xs text-foreground/45">
        {t("support.cardEssay", { title })}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <button
          onClick={() => {
            track("support_card_click", { essay_id: essayId, placement: "essay_end" });
            journeyEvent("support_card_click", { essayId, title, source: "essay_end" });
            open("reader");
          }}
          className="rounded-full bg-foreground px-5 py-2.5 font-medium text-background hover:opacity-85"
        >
          {t("support.cardCta")}
        </button>
        <a href="#essay-subscribe" className="text-foreground/65 underline-offset-4 hover:underline">
          {t("support.cardSubscribe")}
        </a>
        <Link href="/archive" className="text-foreground/65 underline-offset-4 hover:underline">
          {t("support.cardKeepReading")}
        </Link>
      </div>
      <button
        className="mt-5 text-xs text-foreground/40 underline-offset-4 hover:underline"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS)); } catch { /* ignore */ }
          setDismissed(true);
          track("support_card_dismiss", { essay_id: essayId });
        }}
      >
        {t("support.cardDismiss")}
      </button>
    </div>
  );
}
