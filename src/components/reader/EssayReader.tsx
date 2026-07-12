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
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ReadingProgress } from "@/components/reader/ReadingProgress";
import {
  ReadingPreferences,
  ReaderPrefs,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
} from "@/components/reader/ReadingPreferences";
import { AudioPlayer } from "@/components/reader/AudioPlayer";
import { ReactionBar } from "@/components/reader/ReactionBar";
import { isReleasedLocally, localReleaseDate } from "@/lib/release";

export interface EssayReaderProps {
  /** Canonical essay id, used to key the like/dislike signal. */
  essayId: string;
  essay: {
    title: string;
    hook?: string;
    body: string;
    dateLabel: string;
    readingMinutes: number;
    themeLabel: string;
    issue?: number | null;
    archived?: boolean;
    furtherReading?: { title: string; url: string }[];
    audioUrl?: string;
    audioDuration?: number;
  };
  /** Next Monday's topic, if one is queued – the reason to come back. */
  nextTease?: {
    title: string;
    dateLabel: string;
  } | null;
  publishOn?: string | null;
  publishedAt?: string | null;
}

const BYLINE = "The Dailicle Desk";

const SIZE_REM = ["1.125rem", "1.25rem", "1.375rem"];
const LEADING = ["1.75", "1.9"];

export function EssayReader({
  essayId,
  essay,
  nextTease,
  publishOn,
  publishedAt,
}: EssayReaderProps) {
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
    return (
      <div className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 text-center">
          <div className="space-y-4">
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-foreground/50">
              The Dailicle
            </p>
            <h1 className="font-display text-4xl tracking-tight">The next essay arrives Monday.</h1>
            <p className="font-serif text-lg text-foreground/60">Come back at your local midnight.</p>
            <Link href="/" className="inline-block pt-3 font-serif text-foreground/70 underline underline-offset-4">
              Back home
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

  const shareText = `"${essay.title}" – an essay from The Dailicle`;

  const shareOptions = [
    {
      name: "Twitter",
      icon: Twitter,
      action: () => {
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
        await navigator.clipboard.writeText(getShareUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
    },
  ];

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
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
            <span>All essays</span>
          </Link>

          <div className="flex items-center gap-1">
            <ReadingPreferences prefs={prefs} onChange={updatePrefs} />

            <div className="relative">
              <button
                onClick={handleNativeShare}
                className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-foreground transition-colors p-2 rounded-lg hover:bg-foreground/5"
                aria-label="Share essay"
              >
                <Share2 size={18} />
                <span className="hidden sm:inline">Share</span>
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
                            Share this essay
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
                              {option.name === "Copy Link" && copied
                                ? "Copied!"
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

        {/* Header */}
        <header className="mb-14 space-y-5 text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase">
            <span className={essay.archived ? "text-foreground/45" : "text-accent"}>
              {essay.archived
                ? "From the 2025 archive"
                : essay.issue
                  ? `Issue ${essay.issue}`
                  : "The Dailicle"}
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
            By {BYLINE} · {essay.dateLabel} · {essay.readingMinutes} min read
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
              If you want to sit with this longer:
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

        {/* End – rate the essay just read, then the reason to come back */}
        <footer className="mt-20 pt-12 border-t border-foreground/10 text-center space-y-10">
          <ReactionBar essayId={essayId} />

          {nextTease ? (
            <div className="space-y-2 pt-10 border-t border-foreground/10">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent">
                Next Monday · {nextTease.dateLabel}
              </p>
              <p className="font-display text-xl md:text-2xl tracking-tight text-balance">
                {nextTease.title}
              </p>
            </div>
          ) : (
            <p className="text-foreground/45 italic text-sm pt-10 border-t border-foreground/10">
              Thanks for reading. A new essay arrives every Monday.
            </p>
          )}
          <div>
            <Link
              href="/archive"
              className="text-sm font-medium border-b border-foreground/20 pb-0.5 hover:border-accent hover:text-foreground transition-colors"
            >
              Read more essays
            </Link>
          </div>
        </footer>
      </motion.div>
    </article>
  );
}
