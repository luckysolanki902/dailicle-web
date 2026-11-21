import { StartupFeedback } from "@/components/startups/StartupFeedback";
import { LOCALES } from "@/i18n/config";
import { startupHref, startupPath } from "@/i18n/startups";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Markdown from "react-markdown";
import { currentSubscription, hasStartupAccess } from "@/lib/startup-membership";
import { startupBody, startupListing } from "@/lib/startup-essays";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = await params;
  const essay = await startupListing(slug, lang);
  if (!essay) return {};
  return { title: essay.title, description: essay.dek, alternates: { canonical: startupHref(slug, essay.locales.includes(lang) ? lang : "en") }, robots: { index: essay._id === 1, follow: true } };
}

export default async function StartupEssayPage({ params }: Props) {
  const { lang, slug } = await params;
  const essay = await startupListing(slug, lang);
  if (!essay) notFound();
  if (!essay.locales.includes(lang)) redirect(startupHref(slug));
  const id = essay._id > 1 ? await currentSubscription() : null;
  const paid = id ? await hasStartupAccess(id).catch(() => false) : false;
  const body = await startupBody(slug, paid, lang);

  return (
    <article lang={LOCALES[lang].htmlLang} data-clarity-mask={essay._id > 1 ? "true" : undefined} className="mx-auto max-w-2xl pb-20 pt-14 sm:pt-20">
      <p className="text-xs tracking-[.14em] uppercase text-foreground/65">{essay._id === 1 ? "Free essay" : "Members’ essay"}</p>
      <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">{essay.title}</h1>
      <p className="mt-5 font-serif text-xl text-foreground/75">{essay.dek}</p>
      {essay.locales.length > 1 && (
        <nav aria-label="Essay languages" className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {essay.locales.map((locale) => (
            <Link key={locale} href={startupPath(slug, locale)} lang={LOCALES[locale].htmlLang}
              aria-current={locale === lang ? "page" : undefined} className="underline underline-offset-4">
              {LOCALES[locale].native}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-10 border-t border-foreground/15 pt-8">
        {body ? (
          <div className="prose max-w-none font-serif text-lg leading-relaxed prose-p:text-foreground prose-headings:text-foreground prose-a:text-foreground prose-li:text-foreground">
            <Markdown>{body}</Markdown>
          </div>
        ) : (
          <section>
            <h2 className="font-display text-3xl">Continue with membership</h2>
            <p className="mt-3 text-foreground/75">Subscribe or sign in to read this essay and the startup archive.</p>
            <Link href={`${startupPath()}#membership`} className="mt-5 inline-flex rounded-full bg-foreground px-6 py-3 text-sm text-background">Membership and sign-in</Link>
          </section>
        )}
      </div>
      {body && <StartupFeedback slug={slug} />}
    </article>
  );
}
