import { currentStartupAccount, googleConfigured } from "@/lib/startup-google";
import Link from "next/link";
import { SITE_URL } from "@/i18n/config";
import { startupPath } from "@/i18n/startups";

export default async function StartupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const account = await currentStartupAccount();
  const label = account?.name || account?.email;
  const initialsSource = account?.name || account?.email.split("@")[0] || "";
  const initials = initialsSource.split(/[\s._-]+/).filter(Boolean).slice(0, 2)
    .map((part) => Array.from(part)[0]).join("").toLocaleUpperCase() || "•";
  return (
    <main lang="en" className="startup-publication min-h-screen px-6 pb-20">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-3 border-b border-foreground/15 py-5 text-sm sm:gap-x-5">
        <Link href={lang === "en" ? SITE_URL : `${SITE_URL}/${lang}`} className="text-foreground/70 hover:underline">The Dailicle</Link>
        <span aria-hidden="true" className="text-foreground/40">/</span>
        <Link href={startupPath()} className="font-medium hover:underline">Startups</Link>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <Link href={startupPath("archive")} className="font-medium hover:underline">Archive</Link>
          {account ? (
            <details className="relative">
              <summary aria-label={`Signed in as ${label}. Account options`} className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-foreground/15 px-1.5 py-1 pr-2.5 hover:border-foreground/40 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold">{initials}</span>
                <span className="max-w-24 truncate sm:max-w-40">{label}</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-foreground/15 bg-background p-3 shadow-lg">
                <p className="break-all text-xs text-foreground/70">{account.email}</p>
                <form action="/api/startups/sign-out" method="post">
                  <button className="mt-3 w-full rounded-md px-2 py-2 text-left hover:bg-foreground/10">Sign out</button>
                </form>
              </div>
            </details>
          ) : googleConfigured() && (
            <form action="/api/startups/google" method="post">
              <button className="rounded-full border border-foreground/20 px-3 py-1.5 font-medium hover:border-foreground/50">Sign in</button>
            </form>
          )}
        </div>
      </nav>
      {children}
    </main>
  );
}
