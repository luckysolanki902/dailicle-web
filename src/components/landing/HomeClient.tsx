"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { LocalizedLink as Link } from "@/i18n/Link";
import { ThisWeek } from "@/components/landing/ThisWeek";
import { NextWeek } from "@/components/landing/NextWeek";
import { Ethos } from "@/components/landing/Ethos";
import { ReadersByCountry } from "@/components/landing/ReadersByCountry";
import { ReaderWord } from "@/components/landing/ReaderWord";
import { RecentEssays } from "@/components/landing/RecentEssays";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useT } from "@/i18n/I18nProvider";
import { makeThemeLabel } from "@/lib/themes";
import {
  buildHomeView,
  type HomeView,
  type LandingEssay,
  type QueuedTopic,
} from "@/lib/home-view";

interface HomeClientProps {
  published: LandingEssay[];
  queued: QueuedTopic[];
  /** Top readerships from GA (empty ⇒ the section falls back to static data). */
  readers: { name: string; flag: string; share: number }[];
  /**
   * The view computed on the server. The release calendar is the reader's
   * LOCAL calendar and the page is cached, so recomputing it during hydration
   * would diverge from the server HTML (React #418). Render this server view
   * verbatim on the first client render, then recompute with the local clock.
   */
  initialView: HomeView;
  /**
   * Like counts by essay `_id`. Passed down so the post-mount recompute ranks
   * "most popular" from the same numbers the server did — without them the
   * group would fall back to newest-first and visibly reshuffle after hydration.
   */
  likes: Record<string, number>;
}

export function HomeClient({
  published,
  queued,
  initialView,
  readers,
  likes,
}: HomeClientProps) {
  const t = useT();
  const [mounted, setMounted] = useState(false);

  // Deferred so hydration completes against the server view before the local
  // clock takes over (matches the pattern used across the reader).
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const { hero, tease, popular, cards } = useMemo(
    () =>
      mounted
        ? buildHomeView(published, queued, new Date(), makeThemeLabel(t), likes)
        : initialView,
    [mounted, published, queued, initialView, t, likes]
  );

  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />

      <ThisWeek essay={hero} upcoming={!hero ? tease : null} />
      {hero && <NextWeek topic={tease} />}
      <Ethos />
      <ReadersByCountry countries={readers} />
      <ReaderWord />
      <RecentEssays popular={popular} essays={cards} />

      <section className="py-24 px-6 text-center border-t border-foreground/10">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight text-balance">
            {t("home.closing.title")}
            {hero && <span className="block">{t("home.closing.thisWeekHere")}</span>}
          </h2>
          <div className="pt-2">
            <Link
              href={hero ? hero.href : "/archive"}
              className="group inline-flex items-center gap-3 px-9 py-4 bg-foreground text-background rounded-full text-base font-medium transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              <span>{hero ? t("home.closing.startReading") : t("home.closing.visitArchive")}</span>
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="text-xs text-foreground/40">{t("home.closing.free")}</p>
        </div>
      </section>
    </main>
  );
}
