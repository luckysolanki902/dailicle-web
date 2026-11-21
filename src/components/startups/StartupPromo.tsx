"use client";

import { track } from "@/lib/analytics";
import { startupHref } from "@/i18n/startups";
import Link from "next/link";

export function StartupPromo({ inArchive = false }: { inArchive?: boolean }) {
  const placement = inArchive ? "archive" : "home";
  return (
    <aside className={inArchive ? "mb-10" : "mx-auto my-8 max-w-3xl px-6"} lang="en">
      <Link href={`${startupHref()}?from=${placement}`}
        onClick={() => track("startup_promo_click", { placement })}
        className="group flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#4e6854] bg-[#293c30] px-6 py-6 text-[#f7f3e8] transition-colors hover:bg-[#334b3b] focus-visible:outline-2 focus-visible:outline-offset-4 sm:px-8">
        <div className="min-w-0">
          <p className="font-display text-3xl tracking-tight">Dailicle Startups</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#e2e8dd]">
            A Friday publication for people building a company, from finding your first customers to deciding what to build next.
          </p>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold underline decoration-[#9bb6a1] underline-offset-4">
          Explore Startups <span aria-hidden="true">↗</span>
        </span>
      </Link>
    </aside>
  );
}
