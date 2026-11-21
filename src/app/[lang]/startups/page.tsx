import { StartupLandingSignal } from "@/components/startups/StartupLandingSignal";
import { currentStartupAccount, googleConfigured } from "@/lib/startup-google";
import { startupHref, startupPath } from "@/i18n/startups";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStartupAccess, newToken, startupOffer, subscriptionForAccount } from "@/lib/startup-membership";
import { startupOpeningEssay } from "@/lib/startup-essays";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dailicle Startups", description: "Independent essays on starting a company and finding customers.", alternates: { canonical: startupHref() } };

const notices: Record<string, string> = {
  pending: "PayPal is still confirming the subscription. Check again after payment appears in PayPal.",
  cancelled: "You left PayPal checkout.",
  unavailable: "Checkout or sign-in is temporarily unavailable. Please try again.",
  "sign-in-required": "Sign in with Google to continue.",
  "google-unavailable": "Google sign-in is temporarily unavailable.",
  "google-failed": "Google sign-in didn’t finish. Please try again.",
  existing: "There’s already a subscription linked to this browser. Check its billing status in PayPal before subscribing again.",
  unsubscribed: "The Friday email is off. Your membership is unchanged.",
};

export default async function Startups({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ status?: string; from?: string }>;
}) {
  if ((await params).lang !== "en") redirect(startupHref());
  const { status = "", from } = await searchParams;
  const account = await currentStartupAccount();
  const subscription = account ? await subscriptionForAccount(account.subject) : null;
  const [first, price, member] = await Promise.all([
    startupOpeningEssay(),
    account ? startupOffer().catch(() => null) : null,
    subscription ? hasStartupAccess(subscription).catch(() => false) : false,
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <StartupLandingSignal source={from} />
      <header className="py-16 sm:py-24">
        <h1 className="font-serif text-6xl tracking-[-.055em] sm:text-8xl">Startups</h1>
        <p className="mt-5 max-w-xl font-serif text-xl leading-relaxed text-foreground/75">
          A Friday essay about the decisions you face when you start a company.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {first && <Link href={startupPath(first.slug)} className="inline-flex rounded-full bg-foreground px-6 py-3 text-sm text-background hover:opacity-80">Read the free essay</Link>}
          <Link href={startupPath("archive")} className="px-2 text-sm underline underline-offset-4">Browse the archive</Link>
        </div>
      </header>
      {first && (
        <section aria-labelledby="featured-startup" className="border-y border-foreground/15 py-8">
          <p className="mb-2 text-xs tracking-[.14em] uppercase text-foreground/60">Free essay</p>
          <h2 id="featured-startup" className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl">
            <Link className="hover:underline underline-offset-4" href={startupPath(first.slug)}>{first.title}</Link>
          </h2>
          <p className="mt-3 max-w-xl text-foreground/70">{first.dek}</p>
        </section>
      )}
      <section id="membership" className="py-10">
        <h2 className="font-display text-3xl">Membership</h2>
        <p className="mt-2 max-w-xl text-foreground/75">The first essay is free. Members get the Friday edition by email and can read the full startup archive.</p>
        {Object.hasOwn(notices, status) && <p role="status" className="mt-4 text-sm">{notices[status]}</p>}
        {status === "pending" && <Link href="/api/startups/return" prefetch={false} className="mt-2 inline-block text-sm underline">Check PayPal again</Link>}
        {subscription && !member && status !== "pending" && (
          <p className="mt-4 text-sm">We couldn’t confirm a current paid period. <a className="underline" href="https://www.paypal.com/myaccount/autopay/">Check billing in PayPal</a>.</p>
        )}
        {!account ? (
          googleConfigured() ? (
            <form action="/api/startups/google" method="post" className="mt-5">
              <button className="rounded-full bg-foreground px-6 py-3 text-sm text-background">Sign in with Google</button>
            </form>
          ) : <p className="mt-4 text-sm text-foreground/70">Google sign-in is currently unavailable.</p>
        ) : member ? (
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <p>Membership active</p>
            <a className="underline" href="https://www.paypal.com/myaccount/autopay/">Manage in PayPal</a>
            <form action="/api/startups/sign-out" method="post"><button className="underline">Sign out</button></form>
          </div>
        ) : (
          <>
            {price ? (
              <form action="/api/startups/subscribe" method="post" className="mt-5">
                <input type="hidden" name="checkout" value={newToken()} />
                <button className="rounded-full bg-foreground px-6 py-3 text-sm text-background">Subscribe with PayPal · {price} / month</button>
                <p className="mt-2 text-sm text-foreground/70">Renews monthly. Cancel in PayPal and keep access through your paid period. You can opt out of the Friday email anytime.</p>
              </form>
            ) : <p className="mt-4 text-sm text-foreground/70">New subscriptions are currently unavailable.</p>}
            <form action="/api/startups/sign-out" method="post" className="mt-5">
              <button className="text-sm underline">Sign out</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
