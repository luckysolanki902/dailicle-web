import { startupHref, startupPath } from "@/i18n/startups";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSubscription, hasStartupAccess, mailConfigured, newToken, startupOffer } from "@/lib/startup-membership";
import { startupIndex } from "@/lib/startup-essays";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dailicle Startups", description: "Independent essays on starting a company and finding customers.", alternates: { canonical: startupHref() } };

const notices: Record<string, string> = {
  pending: "PayPal is still confirming the subscription. Check again, or sign in with your PayPal email once it’s active.",
  cancelled: "You left PayPal checkout.",
  unavailable: "Checkout or sign-in is temporarily unavailable. Please try again.",
  sent: "If that address has an active membership, a sign-in link will arrive shortly.",
  existing: "There’s already a subscription linked to this browser. Check its billing status in PayPal before subscribing again.",
  unsubscribed: "The Friday email is off. Your membership is unchanged.",
  expired: "That sign-in link has expired or already been used. Request a fresh link below.",
};

export default async function Startups({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  if ((await params).lang !== "en") redirect(startupHref());
  const { status = "" } = await searchParams;
  const subscription = await currentSubscription();
  const [essays, price, member] = await Promise.all([
    startupIndex(),
    startupOffer().catch(() => null),
    subscription ? hasStartupAccess(subscription).catch(() => false) : false,
  ]);
  const first = essays.find((essay) => essay._id === 1)!;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="py-16 sm:py-24">
        <h1 className="font-serif text-6xl tracking-[-.055em] sm:text-8xl">Startups</h1>
        <p className="mt-5 max-w-xl font-serif text-xl leading-relaxed text-foreground/75">
          A Friday essay about the decisions you face when you start a company.
        </p>
        <Link href={startupPath(first.slug)} className="mt-8 inline-flex rounded-full bg-foreground px-6 py-3 text-sm text-background hover:opacity-80">
          Read the first essay free
        </Link>
      </header>
      <section aria-labelledby="startup-archive" className="border-y border-foreground/15 py-8">
        <h2 id="startup-archive" className="text-sm font-medium">Essays</h2>
        <ul className="mt-2 divide-y divide-foreground/10">
          {essays.map((essay) => (
            <li key={essay._id}>
              <Link href={startupPath(essay.slug)} className="group block py-5">
                <p className="text-xs text-foreground/60">{essay._id === 1 ? "Free essay" : "Members"}</p>
                <h3 className="mt-1 font-display text-3xl group-hover:underline decoration-1 underline-offset-4">{essay.title}</h3>
                <p className="mt-1 max-w-xl text-foreground/70">{essay.dek}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section id="membership" className="py-10">
        <h2 className="font-display text-3xl">Membership</h2>
        <p className="mt-2 max-w-xl text-foreground/75">The first essay is free. Members get the Friday edition by email and can read the full startup archive.</p>
        {Object.hasOwn(notices, status) && <p role="status" className="mt-4 text-sm">{notices[status]}</p>}
        {status === "pending" && <Link href="/api/startups/return" prefetch={false} className="mt-2 inline-block text-sm underline">Check PayPal again</Link>}
        {subscription && !member && status !== "pending" && (
          <p className="mt-4 text-sm">We couldn’t confirm a current paid period. <a className="underline" href="https://www.paypal.com/myaccount/autopay/">Check billing in PayPal</a>.</p>
        )}
        {member ? (
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
            {mailConfigured() && (
              <form action="/api/startups/email" method="post" className="mt-7">
                <label className="block text-sm font-medium" htmlFor="member-email">Already a member? Sign in with your PayPal email.</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input id="member-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" className="rounded-lg border border-foreground/30 bg-background px-3 py-2" />
                  <button className="rounded-lg border border-foreground/30 px-4 py-2 text-sm">Email me a link</button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
