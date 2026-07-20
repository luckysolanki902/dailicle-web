"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Share2,
  Twitter,
  Linkedin,
  Link2,
  Check,
  MessageCircle,
  X,
} from "lucide-react";
import { LocalizedLink as Link } from "@/i18n/Link";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ReadingProgress } from "@/components/reader/ReadingProgress";
import {
  ReadingPreferences,
  ReaderPrefs,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
} from "@/components/reader/ReadingPreferences";
import { AudioPlayer } from "@/components/reader/AudioPlayer";
import { EssayBanner } from "@/components/ui/EssayBanner";
import { ReactionBar } from "@/components/reader/ReactionBar";
import { SubscribeForm } from "@/components/reader/SubscribeForm";
import { ScrollSubscribeNudge } from "@/components/reader/ScrollSubscribeNudge";
import { ReadingSupportTrigger } from "@/components/support/ReadingSupportTrigger";
import { isReleasedLocally, localReleaseDate } from "@/lib/release";
import {
  track,
  clarityTag,
  markEssayRead,
  setCurrentEssay,
} from "@/lib/analytics";

export interface EssayReaderProps {
  /** Canonical essay id, used to key the like/dislike signal. */
  essayId: string;
  /** English slug – the switcher swaps only the locale, not the slug. */
  slug?: string;
  /** Current locale (for analytics / display). */
  locale?: string;
  /** True when the shown body is a translation, not the English original. */
  isTranslated?: boolean;
  essay: {
    title: string;
    hook?: string;
    body: string;
    dateLabel: string;
    readingMinutes: number;
    themeLabel: string;
    /** Category slug (psychology | relationships | philosophy | society | money). */
    category?: string;
    issue?: number | null;
    archived?: boolean;
    furtherReading?: { title: string; url: string }[];
    audioUrl?: string;
    audioDuration?: number;
    /** Editorial banner illustration, already resolved to a full CDN URL. */
    bannerUrl?: string | null;
    /** Whether the banner image has a transparent background. */
    bannerTransparent?: boolean;
  };
  /** Next Monday's topic, if one is queued – the reason to come back. */
  nextTease?: {
    title: string;
    dateLabel: string;
  } | null;
  /** Two hard-recommended essays to read next (same theme first). */
  related?: {
    href: string;
    title: string;
    hook?: string;
    themeLabel: string;
    readingMinutes: number;
  }[];
  publishOn?: string | null;
  publishedAt?: string | null;
}

const BYLINE = "The Dailicle Desk";

const SIZE_REM = ["1.125rem", "1.25rem", "1.375rem"];
const LEADING = ["1.75", "1.9"];

function returnMessage(
  releaseAt: Date | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: string,
  now = new Date()
): string {
  if (!releaseAt) return t("reader.comeBackSoon");

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (releaseAt.getTime() === tomorrow.getTime()) return t("reader.comeBackTomorrow");

  return t("reader.comeBackOn", {
    date: releaseAt.toLocaleDateString(locale, { month: "long", day: "numeric" }),
  });
}

export function EssayReader({
  essayId,
  locale = "en",
  essay,
  nextTease,
  related,
  publishOn,
  publishedAt,
}: EssayReaderProps) {
  const t = useT();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  // Start closed on the server so a direct reader URL cannot render a
  // weekend-generated essay before the browser checks its local clock.
  const [isReleased, setIsReleased] = useState<boolean | null>(null);

  useEffect(() => {
    // deferred so hydration completes with defaults before stored prefs apply
    const t = setTimeout(() => setPrefs(loadPrefs()), 0);
    return () => clearTimeout(t);
  }, []);

  // Reading funnel: view -> scroll milestones -> engaged time -> complete.
  useEffect(() => {
    if (isReleased !== true) return;

    const category = essay.category || "unknown";
    const base = {
      essay_id: essayId,
      essay_title: essay.title,
      category,
      category_label: essay.themeLabel,
      issue: essay.issue ?? undefined,
      reading_minutes: essay.readingMinutes,
      is_archived: !!essay.archived,
    };

    // Let the globally-mounted support dialog attribute itself to this essay.
    setCurrentEssay({
      id: essayId,
      category,
      categoryLabel: essay.themeLabel,
      title: essay.title,
    });
    markEssayRead(essayId);
    clarityTag("category", category);
    clarityTag("last_essay", essay.title);
    track("essay_view", base);

    const milestones = [25, 50, 75, 100] as const;
    const hit = new Set<number>();
    let maxScroll = 0;
    let activeMs = 0;
    let lastTick = Date.now();
    let completed = false;
    let flushed = false;

    const markComplete = () => {
      if (completed) return;
      completed = true;
      clarityTag("read_complete", "true");
      track("read_complete", {
        ...base,
        active_seconds: Math.round(activeMs / 1000),
      });
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      const pct =
        total > 0 ? Math.min(100, Math.round((window.scrollY / total) * 100)) : 100;
      if (pct > maxScroll) maxScroll = pct;
      for (const m of milestones) {
        if (pct >= m && !hit.has(m)) {
          hit.add(m);
          track("read_progress", { ...base, percent: m });
          if (m === 100) markComplete();
        }
      }
    };

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") activeMs += now - lastTick;
      lastTick = now;
      // Genuine read of most of the estimated time also counts as complete.
      if (
        !completed &&
        essay.readingMinutes > 0 &&
        activeMs >= essay.readingMinutes * 60 * 1000 * 0.6
      ) {
        markComplete();
      }
    }, 2000);

    // A single engaged_time event carrying the final totals, sent once.
    const flush = () => {
      if (flushed) return;
      flushed = true;
      track("engaged_time", {
        ...base,
        active_seconds: Math.round(activeMs / 1000),
        max_scroll: maxScroll,
        completed,
      });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    onScroll();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
      setCurrentEssay(null);
    };
  }, [
    isReleased,
    essayId,
    essay.category,
    essay.title,
    essay.themeLabel,
    essay.issue,
    essay.readingMinutes,
    essay.archived,
  ]);

  useEffect(() => {
    const release = { publish_on: publishOn, published_at: publishedAt };
    const checkRelease = () => setIsReleased(isReleasedLocally(release));
    checkRelease();

    const releaseAt = localReleaseDate(release);
    if (!releaseAt || releaseAt.getTime() <= Date.now()) return;

    const timer = window.setTimeout(checkRelease, releaseAt.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [publishOn, publishedAt]);

  if (!isReleased) {
    const releaseAt = localReleaseDate({ publish_on: publishOn, published_at: publishedAt });
    // Keep server and first-client render identical. Once the browser has
    // checked its own clock, show the useful local calendar date.
    const message =
      isReleased === null ? t("reader.comeBackSoon") : returnMessage(releaseAt, t, locale);

    return (
      <div className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 text-center">
          <div className="space-y-4">
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-foreground/50">
              {t("common.siteName")}
            </p>
            <h1 className="font-display text-4xl tracking-tight">{t("reader.notReleased")}</h1>
            <p className="font-serif text-lg text-foreground/60">{message}</p>
            <Link href="/" className="inline-block pt-3 font-serif text-foreground/70 underline underline-offset-4">
              {t("common.backHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const updatePrefs = (next: ReaderPrefs) => {
    setPrefs(next);
    savePrefs(next);
  };

  const getShareUrl = () =>
    typeof window !== "undefined" ? window.location.href : "";

  const shareText = t("reader.shareText", { title: essay.title });

  const trackShare = (channel: string) =>
    track("share_click", {
      channel,
      essay_id: essayId,
      essay_title: essay.title,
      category: essay.category || "unknown",
    });

  const shareOptions = [
    {
      name: "Twitter",
      icon: Twitter,
      action: () => {
        trackShare("twitter");
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(getShareUrl())}`,
          "_blank",
          "noopener,noreferrer"
        );
      },
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      action: () => {
        trackShare("linkedin");
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`,
          "_blank",
          "noopener,noreferrer"
        );
      },
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      action: () => {
        trackShare("whatsapp");
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${getShareUrl()}`)}`,
          "_blank",
          "noopener,noreferrer"
        );
      },
    },
    {
      name: "Copy Link",
      icon: copied ? Check : Link2,
      action: async () => {
        trackShare("copy_link");
        await navigator.clipboard.writeText(getShareUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
    },
  ];

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        trackShare("native");
        await navigator.share({
          title: essay.title,
          text: shareText,
          url: getShareUrl(),
        });
      } catch {
        setShowShareMenu(true);
      }
    } else {
      setShowShareMenu(true);
    }
  };

  return (
    <article className="min-h-screen py-12 md:py-20 px-4 md:px-6 overflow-x-hidden">
      <ReadingProgress />
      <ReadingSupportTrigger />
      <ScrollSubscribeNudge />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl mx-auto"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/archive"
            className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            <span>{t("reader.allEssays")}</span>
          </Link>

          <div className="flex items-center gap-1">
            <LanguageSwitcher variant="toolbar" align="right" />
            <ReadingPreferences prefs={prefs} onChange={updatePrefs} />

            <div className="relative">
              <button
                onClick={handleNativeShare}
                className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-foreground transition-colors p-2 rounded-lg hover:bg-foreground/5"
                aria-label={t("reader.shareAria")}
              >
                <Share2 size={18} />
                <span className="hidden sm:inline">{t("reader.share")}</span>
              </button>

              <AnimatePresence>
                {showShareMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setShowShareMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl shadow-2xl overflow-hidden bg-background border border-foreground/15"
                    >
                      <div className="p-2">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-foreground/10 mb-2">
                          <span className="text-xs font-medium text-foreground/50">
                            {t("reader.shareThisEssay")}
                          </span>
                          <button
                            onClick={() => setShowShareMenu(false)}
                            className="text-foreground/40 hover:text-foreground"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {shareOptions.map((option) => (
                          <button
                            key={option.name}
                            onClick={() => {
                              option.action();
                              if (option.name !== "Copy Link") setShowShareMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground/80 hover:bg-foreground/5 rounded-lg transition-colors"
                          >
                            <option.icon size={16} />
                            <span>
                              {option.name === "Copy Link"
                                ? copied
                                  ? t("reader.copied")
                                  : t("reader.copyLink")
                                : option.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Banner illustration — contained to the reading column, edges faded
            into the page so it merges seamlessly on every theme */}
        {essay.bannerUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mb-8 md:mb-10"
          >
            <EssayBanner
              src={essay.bannerUrl}
              alt={essay.title}
              transparent={essay.bannerTransparent}
              priority
              sizes="(max-width: 768px) 100vw, 640px"
            />
          </motion.div>
        )}

        {/* Header */}
        <header className="mb-14 space-y-5 text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase">
            <span className={essay.archived ? "text-foreground/45" : "text-accent"}>
              {essay.archived
                ? t("reader.fromArchive")
                : essay.issue
                  ? t("reader.issue", { issue: essay.issue })
                  : t("common.siteName")}
            </span>
            <span className="text-foreground/40 font-medium">
              {" · "}
              {essay.themeLabel}
            </span>
          </p>

          <h1 className="font-display text-3xl md:text-5xl leading-[1.12] tracking-tight text-balance">
            {essay.title}
          </h1>

          {essay.hook && (
            <p className="font-display italic text-base md:text-lg text-foreground/55 max-w-lg mx-auto leading-relaxed text-balance">
              {essay.hook}
            </p>
          )}

          <p className="text-xs text-foreground/45 pt-1">
            {t("reader.by", {
              author: BYLINE,
              date: essay.dateLabel,
              minutes: essay.readingMinutes,
            })}
          </p>

          {essay.audioUrl && (
            <div className="pt-1">
              <AudioPlayer
                src={essay.audioUrl}
                estimatedDuration={essay.audioDuration}
              />
            </div>
          )}
        </header>

        {/* The essay */}
        <div
          className={cn(
            "prose prose-lg mx-auto",
            "prose-headings:font-display prose-headings:tracking-tight",
            "prose-p:text-foreground/90",
            "prose-a:text-foreground prose-a:underline prose-a:decoration-accent/50 prose-a:underline-offset-4 hover:prose-a:decoration-accent",
            "prose-blockquote:border-l-2 prose-blockquote:border-accent/50 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-foreground/80",
            "prose-strong:font-semibold prose-strong:text-foreground",
            "prose-code:bg-foreground/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
            "prose-hr:border-foreground/10 prose-hr:my-12",
            "text-foreground",
            prefs.serifBody && "font-display"
          )}
          style={{
            fontSize: SIZE_REM[prefs.size],
            lineHeight: LEADING[prefs.relaxed ? 1 : 0],
          }}
        >
          <ReactMarkdown>{essay.body}</ReactMarkdown>
        </div>

        {/* Further reading – quiet, optional, never a dump */}
        {essay.furtherReading && essay.furtherReading.length > 0 && (
          <aside className="mt-16 pt-10 border-t border-foreground/10">
            <p className="text-sm text-foreground/50 italic mb-4">
              {t("reader.furtherReadingIntro")}
            </p>
            <ul className="space-y-2">
              {essay.furtherReading.map((item, i) => (
                <li key={i}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground/70 underline decoration-accent/40 underline-offset-4 hover:decoration-accent transition-colors"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* End – rate the essay just read, then capture the email, then send
            them straight into a second essay (the retention levers). */}
        <footer className="mt-20 pt-12 border-t border-foreground/10 space-y-12">
          <div className="text-center">
            <ReactionBar essayId={essayId} />
          </div>

          {/* Free-subscribe box — the primary ask at the high-intent moment */}
          <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] px-6 py-8 text-center sm:px-10">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent">
              {t("reader.subscribe.eyebrow")}
            </p>
            <h2 className="mt-3 font-display text-2xl tracking-tight text-balance md:text-[1.6rem]">
              {t("reader.subscribe.heading")}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-serif text-[15px] leading-relaxed text-foreground/60 text-balance">
              {t("reader.subscribe.sub")}
            </p>
            {nextTease && (
              <p className="mx-auto mt-4 max-w-md text-sm text-foreground/70">
                <span className="font-semibold text-foreground/80">
                  {t("reader.subscribe.nextWeek")}
                </span>{" "}
                <span className="italic">{nextTease.title}</span>
              </p>
            )}
            <div className="mt-6">
              <SubscribeForm source="reader" />
            </div>
            <p className="mt-3 text-[11px] text-foreground/35">
              {t("reader.subscribe.reassure")}
            </p>
          </div>

          {/* Keep reading — two specific, hooked recommendations */}
          {related && related.length > 0 && (
            <div className="pt-2">
              <p className="mb-5 text-center text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/40">
                {t("reader.keepReading")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    onClick={() =>
                      track("related_click", { from: essayId, to: r.href })
                    }
                    className="group flex flex-col rounded-2xl border border-foreground/10 bg-background/40 p-5 text-left transition-colors hover:border-accent/40 hover:bg-foreground/[0.03]"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">
                      {r.themeLabel}
                      {" · "}
                      {t("reader.minRead", { minutes: r.readingMinutes })}
                    </span>
                    <span className="mt-2 font-display text-lg leading-snug tracking-tight text-balance transition-colors group-hover:text-accent">
                      {r.title}
                    </span>
                    {r.hook && (
                      <span className="mt-1.5 font-serif text-sm italic leading-relaxed text-foreground/55 line-clamp-3">
                        {r.hook}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/archive"
              className="text-sm font-medium border-b border-foreground/20 pb-0.5 hover:border-accent hover:text-foreground transition-colors"
            >
              {t("reader.readMore")}
            </Link>
          </div>
        </footer>
      </motion.div>
    </article>
  );
}
