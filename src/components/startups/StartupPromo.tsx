import { startupHref } from "@/i18n/startups";
import Link from "next/link";

export function StartupPromo({ inArchive = false }: { inArchive?: boolean }) {
  return (
    <aside className={inArchive ? "mb-10" : "mx-auto my-12 max-w-2xl px-6"} lang="en">
      <Link href={startupHref()} className="group flex flex-wrap items-center justify-between gap-4 border-y border-foreground/15 py-6">
        <div>
          <p className="mb-1 text-xs tracking-[.16em] uppercase text-foreground/60">Dailicle Startups</p>
          <p className="font-display text-2xl">Building something of your own?</p>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-foreground/65">
            Friday essays about finding customers and deciding what to build next.
          </p>
        </div>
        <span className="text-sm underline decoration-foreground/35 underline-offset-4 group-hover:decoration-current">
          Read a free essay <span aria-hidden="true">↗</span>
        </span>
      </Link>
    </aside>
  );
}
