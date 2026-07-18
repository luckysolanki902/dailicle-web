"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThisWeek } from "@/components/landing/ThisWeek";
import { NextWeek } from "@/components/landing/NextWeek";
import { Ethos } from "@/components/landing/Ethos";
import { ReadersByCountry } from "@/components/landing/ReadersByCountry";
import { ReaderWord } from "@/components/landing/ReaderWord";
import { RecentEssays } from "@/components/landing/RecentEssays";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import {
  buildHomeView,
  type HomeView,
  type LandingEssay,
  type QueuedTopic,
} from "@/lib/home-view";

interface HomeClientProps {
  published: LandingEssay[];
  queued: QueuedTopic[];
  /**
   * The view computed on the server. The release calendar is the reader's
   * LOCAL calendar and the page is cached, so recomputing it during hydration
   * would diverge from the server HTML (React #418). Render this server view
   * verbatim on the first client render, then recompute with the local clock.
   */
  initialView: HomeView;
}

export function HomeClient({ published, queued, initialView }: HomeClientProps) {
  const [mounted, setMounted] = useState(false);

  // Deferred so hydration completes against the server view before the local
  // clock takes over (matches the pattern used across the reader).
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const { hero, tease, cards } = useMemo(
    () => (mounted ? buildHomeView(published, queued, new Date()) : initialView),
    [mounted, published, queued, initialView]
  );

  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />

      <ThisWeek essay={hero} upcoming={!hero ? tease : null} />
      {hero && <NextWeek topic={tease} />}
      <Ethos />
      <ReadersByCountry />
      <ReaderWord />
      <RecentEssays essays={cards} />

      <section className="py-24 px-6 text-center border-t border-foreground/10">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight text-balance">
            The next essay arrives Monday.
            {hero && <span className="block">This week&apos;s is already here.</span>}
          </h2>
          <div className="pt-2">
            <Link
              href={hero ? hero.href : "/archive"}
              className="group inline-flex items-center gap-3 px-9 py-4 bg-foreground text-background rounded-full text-base font-medium transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              <span>{hero ? "Start reading" : "Visit the archive"}</span>
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="text-xs text-foreground/40">
            Free to read · nothing to sign up for · no ads
          </p>
        </div>
      </section>
    </main>
  );
}
