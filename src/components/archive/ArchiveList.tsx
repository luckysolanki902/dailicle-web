"use client";

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LocalizedLink as Link } from "@/i18n/Link";
import { ChevronDown, Search, X } from "lucide-react";
import { THEMES, makeThemeLabel } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { isReleasedLocally } from "@/lib/release";
import {
  DEFAULT_SORT,
  SORT_MODES,
  isSortMode,
  sortEntries,
  type SortMode,
} from "@/lib/archive-sort";
import { EssayBanner } from "@/components/ui/EssayBanner";
import { useT } from "@/i18n/I18nProvider";

export interface ArchiveEntry {
  href: string;
  title: string;
  hook: string;
  theme: string;
  readingMinutes: number;
  dateLabel: string;
  publishOn?: string | null;
  publishedAt?: string | null;
  issue?: number | null;
  /**
   * How many readers liked the essay. Used only to order the list — the number
   * itself is never shown, the same way the reaction bar shows no totals.
   */
  likes?: number;
  /** Resolved CDN banner URL, if the essay has an enabled banner. */
  bannerUrl?: string | null;
  /**
   * Whether the entry is released, decided on the server. The release calendar
   * is the reader's LOCAL calendar (see lib/release), so the client must not
   * recompute it during hydration – it replays this value first, then updates.
   */
  initialReleased?: boolean;
}

interface ArchiveListProps {
  current: ArchiveEntry[]; // the weekly era – the publication proper
  legacy: ArchiveEntry[]; // the 2025 archive – tucked away, never promoted
}

function EntryRow({
  entry,
  index,
  muted = false,
}: {
  entry: ArchiveEntry;
  index: number;
  muted?: boolean;
}) {
  const t = useT();
  const label = makeThemeLabel(t);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.04 }}
    >
      <Link
        href={entry.href}
        className={cn(
          "group flex items-start gap-4 py-6 border-b border-foreground/10 hover:bg-foreground/[0.03] transition-colors -mx-4 px-4 rounded-lg",
          muted && "py-4 opacity-75 hover:opacity-100"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-1.5">
            <span className={muted ? "text-foreground/45" : "text-accent"}>
              {label(entry.theme)}
            </span>
            <span className="text-foreground/40 font-medium">
              {entry.issue ? ` · ${t("archive.issue", { issue: entry.issue })}` : ""} ·{" "}
              {entry.dateLabel} · {t("archive.minutes", { minutes: entry.readingMinutes })}
            </span>
          </p>
          <h3
            className={cn(
              "font-display leading-snug tracking-tight group-hover:underline decoration-foreground/25 underline-offset-4",
              muted ? "text-base md:text-lg text-foreground/80" : "text-lg md:text-xl"
            )}
          >
            {entry.title}
          </h3>
          {!muted && entry.hook && (
            <p className="mt-1.5 text-sm text-foreground/55 leading-relaxed line-clamp-2">
              {entry.hook}
            </p>
          )}
        </div>
        {!muted && entry.bannerUrl && (
          <div className="hidden shrink-0 sm:block sm:w-32 md:w-40">
            <EssayBanner
              src={entry.bannerUrl}
              alt={entry.title}
              rounded="rounded-lg"
              sizes="160px"
              className="transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        )}
      </Link>
    </motion.div>
  );
}

export function ArchiveList({ current, legacy }: ArchiveListProps) {
  const t = useT();
  const label = makeThemeLabel(t);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const [theme, setThemeState] = useState<string | null>(null);
  // The server hands `current` over already sorted this way, so the first
  // render matches the HTML exactly.
  const [sort, setSortState] = useState<SortMode>(DEFAULT_SORT);

  /** Mirror a control into the URL without triggering a navigation. */
  const syncUrl = useCallback((key: string, value: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Keep the URL shareable without triggering a navigation.
  const setTheme = useCallback(
    (slug: string | null) => {
      setThemeState(slug);
      syncUrl("theme", slug);
    },
    [syncUrl]
  );

  const setSort = useCallback(
    (mode: SortMode) => {
      setSortState(mode);
      // The default needs no parameter — a bare /archive stays the clean URL.
      syncUrl("sort", mode === DEFAULT_SORT ? null : mode);
    },
    [syncUrl]
  );

  // Read the shared ?theme= / ?sort= from the URL on the client so the page
  // itself stays statically rendered (reading searchParams on the server would
  // opt the whole route into dynamic rendering on every request).
  React.useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get("theme");
    if (urlTheme && THEMES.some((th) => th.slug === urlTheme)) {
      setThemeState(urlTheme);
    }
    const urlSort = params.get("sort");
    if (isSortMode(urlSort)) setSortState(urlSort);
    return () => window.clearTimeout(id);
  }, []);

  // Chips and search work on the current era only – the 2025 archive sits
  // apart and unfiltered, an option rather than part of the catalogue.
  // Before mount, replay the server's release decision so hydration matches;
  // afterwards, recompute against the reader's own local clock.
  const releasedCurrent = current.filter((entry) =>
    mounted
      ? isReleasedLocally(
          { publish_on: entry.publishOn, published_at: entry.publishedAt },
          new Date()
        )
      : entry.initialReleased ?? true
  );

  const countFor = (slug: string) => releasedCurrent.filter((e) => e.theme === slug).length;

  let shown = releasedCurrent;
  if (theme) shown = shown.filter((e) => e.theme === theme);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    shown = shown.filter(
      (e) => e.title.toLowerCase().includes(q) || e.hook.toLowerCase().includes(q)
    );
  }
  shown = sortEntries(shown, sort);

  return (
    <div className="max-w-2xl mx-auto px-6 py-24">
      {/* Header */}
      <header className="mb-12 space-y-5 text-center">
        <h1 className="font-display text-4xl md:text-5xl tracking-tight">{t("archive.title")}</h1>
        <p className="text-foreground/55 text-base">{t("archive.subtitle")}</p>
      </header>

      {/* Controls */}
      <div className="mb-12 space-y-5">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/35"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("archive.searchPlaceholder")}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 focus:border-accent/60 focus:outline-none text-sm placeholder:text-foreground/35 transition-colors"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setTheme(null)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
              theme === null
                ? "bg-foreground text-background border-foreground"
                : "border-foreground/15 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {t("archive.all")} <span className="opacity-50">{releasedCurrent.length}</span>
          </button>
          {THEMES.map((th) => {
            const count = countFor(th.slug);
            return (
              <button
                key={th.slug}
                onClick={() => setTheme(theme === th.slug ? null : th.slug)}
                disabled={count === 0}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  theme === th.slug
                    ? "bg-foreground text-background border-foreground"
                    : count === 0
                      ? "border-foreground/10 text-foreground/25 cursor-not-allowed"
                      : "border-foreground/15 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
                )}
              >
                {label(th.slug)} <span className="opacity-50">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Sort. Deliberately quieter than the theme chips — it reorders the
            same list rather than narrowing it, so it shouldn't compete. */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="text-[11px] text-foreground/35">
            {t("archive.sort.label")}
          </span>
          <div
            role="group"
            aria-label={t("archive.sort.label")}
            className="flex items-center gap-0.5 rounded-full border border-foreground/10 p-0.5"
          >
            {SORT_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setSort(mode)}
                aria-pressed={sort === mode}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
                  sort === mode
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/45 hover:text-foreground/75"
                )}
              >
                {t(`archive.sort.${mode}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current era */}
      {shown.length > 0 ? (
        <section className="mb-20">
          {shown.map((entry, i) => (
            <EntryRow key={entry.href} entry={entry} index={i} />
          ))}
        </section>
      ) : (
        <div className="text-center py-16 space-y-4 mb-10">
          <p className="text-foreground/50 text-sm">
            {query ? t("archive.noMatchQuery", { query }) : t("archive.noMatch")}
          </p>
          {(query || theme) && (
            <button
              onClick={() => {
                setQuery("");
                setTheme(null);
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline underline-offset-4"
            >
              <X size={14} />
              {t("archive.clearFilters")}
            </button>
          )}
        </div>
      )}

      {/* 2025 archive – a closed drawer, not a shelf */}
      {legacy.length > 0 && (
        <section className="border-t border-foreground/10 pt-8">
          <button
            onClick={() => setShowLegacy((v) => !v)}
            className="w-full flex items-center justify-between py-2 text-left group"
            aria-expanded={showLegacy}
          >
            <span className="text-xs font-medium tracking-[0.18em] uppercase text-foreground/40 group-hover:text-foreground/60 transition-colors">
              {t("archive.legacyToggle", { count: legacy.length })}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-foreground/35 transition-transform duration-300",
                showLegacy && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {showLegacy && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  {legacy.map((entry, i) => (
                    <EntryRow key={entry.href} entry={entry} index={i} muted />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
