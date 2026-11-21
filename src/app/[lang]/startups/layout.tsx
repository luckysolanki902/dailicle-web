import Link from "next/link";
import { SITE_URL } from "@/i18n/config";
import { startupPath } from "@/i18n/startups";

export default async function StartupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <main lang="en" className="startup-publication min-h-screen px-6 pb-20">
      <nav className="mx-auto flex max-w-3xl items-center gap-4 border-b border-foreground/15 py-6 pr-14 text-sm">
        <Link href={lang === "en" ? SITE_URL : `${SITE_URL}/${lang}`} className="text-foreground/70 hover:underline">The Dailicle</Link>
        <span aria-hidden="true" className="text-foreground/40">/</span>
        <Link href={startupPath()} className="font-medium hover:underline">Startups</Link>
      </nav>
      {children}
    </main>
  );
}
