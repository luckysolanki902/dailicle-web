import { timingSafeEqual } from "node:crypto";
import { startupOrigin, startupPath } from "@/i18n/startups";
import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/i18n/config";
import { createPaypalStartupSubscription, getPaypalStartupSubscription, isLive, verifyPaypalWebhook } from "@/lib/paypal";
import {
  checkoutCookie, cookieOptions, createSession, currentSubscription, hasStartupAccess,
  newToken, paypalMode, planId, redeemStartupLink, registerStartupMember, sendStartupSignIn,
  sessionCookie, startupCheckouts, startupMembers, startupOffer, startupTokens, tokenHash, validSubscription, validToken,
} from "@/lib/startup-membership";

type Context = { params: Promise<{ action: string }> };
function appOrigin(request: NextRequest) {
  if (startupOrigin) return startupOrigin;
  return process.env.NODE_ENV === "production" ? new URL(SITE_URL).origin : request.nextUrl.origin;
}
const go = (request: NextRequest, suffix = "") => {
  const response = NextResponse.redirect(new URL(`${startupPath()}${suffix}`, appOrigin(request)), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

async function signedIn(request: NextRequest, id: string) {
  const session = await createSession(id);
  const response = go(request);
  response.cookies.set(sessionCookie, session.token, { ...cookieOptions, maxAge: session.maxAge });
  response.cookies.set(checkoutCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

async function start(request: NextRequest, form: FormData) {
  if (!await startupOffer()) return go(request, "?status=unavailable");
  const id = await currentSubscription();
  if (id) {
    if (await hasStartupAccess(id)) return go(request);
    const subscription = await getPaypalStartupSubscription(id);
    if (["APPROVED", "ACTIVE", "SUSPENDED"].includes(String(subscription.status))) {
      return go(request, "?status=existing");
    }
  }
  const state = String(form.get("checkout") ?? "");
  if (!validToken(state)) return go(request, "?status=unavailable");
  const now = new Date();
  const checkout = await startupCheckouts();
  const key = tokenHash(state);
  await checkout.updateOne(
    { _id: key },
    { $setOnInsert: { mode: paypalMode(), plan: planId(), createdAt: now, recoveryUntil: new Date(now.getTime() + 7 * 86400_000) } },
    { upsert: true },
  );
  const attempt = await checkout.findOne({ _id: key, mode: paypalMode(), plan: planId(), createdAt: { $gt: new Date(now.getTime() - 3600_000) } });
  if (!attempt) return go(request, "?status=unavailable");
  const origin = appOrigin(request);
  const data = await createPaypalStartupSubscription(planId(), state, `${origin}/api/startups/return`, `${origin}${startupPath()}?status=cancelled`);
  const subscription = String(data.id ?? "");
  const approve = (data.links as { rel: string; href: string }[] | undefined)?.find((link) => link.rel === "approve");
  if (!validSubscription(subscription) || !approve) return go(request, "?status=unavailable");
  const target = new URL(approve.href);
  const expectedHost = isLive() ? "www.paypal.com" : "www.sandbox.paypal.com";
  if (target.origin !== `https://${expectedHost}`) return go(request, "?status=unavailable");
  const saved = await checkout.updateOne({ _id: key, $or: [{ subscription: { $exists: false } }, { subscription }] }, { $set: { subscription } });
  if (!saved.matchedCount) return go(request, "?status=unavailable");
  const response = NextResponse.redirect(target, 303);
  response.cookies.set(checkoutCookie, state, { ...cookieOptions, maxAge: 3600 });
  return response;
}

async function webhook(request: NextRequest) {
  const webhookId = process.env.PAYPAL_STARTUP_WEBHOOK_ID;
  if (!webhookId) return new Response(null, { status: 503 });
  const event = await request.json();
  if (event.event_type !== "BILLING.SUBSCRIPTION.ACTIVATED") return new Response(null, { status: 204 });
  if (!await verifyPaypalWebhook(request.headers, event, webhookId)) return new Response(null, { status: 400 });
  const id = String(event.resource?.id ?? "");
  if (validSubscription(id)) {
    const data = await getPaypalStartupSubscription(id);
    const state = String(data.custom_id ?? "");
    if (validToken(state)) await registerStartupMember(id, state);
  }
  return new Response(null, { status: 204 });
}

export async function GET(request: NextRequest, { params }: Context) {
  const { action } = await params;
  if (action === "sign-in" || action === "unsubscribe") {
    const signIn = action === "sign-in";
    // The recovery token stays in the fragment and this page loads no third-party code.
    const nonce = newToken();
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>${signIn ? "Sign in to Dailicle Startups" : "Friday email preferences"}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style nonce="${nonce}">body{color-scheme:light dark;font:1.1rem system-ui;margin:15vh auto;padding:0 1.5rem;max-width:32rem}button{font:inherit;padding:.65rem 1rem}</style>
      <h1>${signIn ? "Sign in to Dailicle Startups" : "Stop the Friday email"}</h1>
      <form method="post"><input type="hidden" name="token"><button disabled>${signIn ? "Continue to Startups" : "Unsubscribe from Friday emails"}</button></form>
      ${signIn ? `<p><a href="${startupPath()}#membership">Request a new link</a></p>` : "<p>Your paid membership continues.</p>"}
      <script nonce="${nonce}">
        const token=location.hash.slice(1);
        history.replaceState(null,"",location.pathname);
        if (/^[A-Za-z0-9_-]{32}$/.test(token)) {
          document.querySelector("input").value=token;
          document.querySelector("button").disabled=false;
        }
      </script></html>`, { headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      } });
  }
  if (action !== "return") return new Response(null, { status: 405 });
  try {
    const state = request.cookies.get(checkoutCookie)?.value ?? "";
    if (!validToken(state)) return go(request, "?status=pending");
    const attempt = await (await startupCheckouts()).findOne({ _id: tokenHash(state), mode: paypalMode(), createdAt: { $gt: new Date(Date.now() - 3600_000) } });
    if (!attempt?.subscription || !await registerStartupMember(attempt.subscription, state)) return go(request, "?status=pending");
    return await signedIn(request, attempt.subscription);
  } catch {
    return go(request, "?status=unavailable");
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { action } = await params;
  if (action === "eligibility") {
    const secret = process.env.STARTUPS_CRON_SECRET;
    const supplied = request.headers.get("authorization") ?? "";
    if (!secret || !timingSafeEqual(Buffer.from(tokenHash(supplied), "hex"), Buffer.from(tokenHash(`Bearer ${secret}`), "hex"))) {
      return new Response(null, { status: 403 });
    }
    try {
      const ids: unknown = (await request.json()).subscriptions;
      if (!Array.isArray(ids) || ids.length > 12 || ids.some((id) => typeof id !== "string" || !validSubscription(id))) {
        return new Response(null, { status: 400 });
      }
      const members = await (await startupMembers()).find({ subscription: { $in: ids }, mode: paypalMode(), newsletter: { $ne: false } }).toArray();
      const checks = await Promise.all(members.map(async ({ subscription }) => ({
        subscription, eligible: await hasStartupAccess(subscription),
      })));
      return Response.json({ eligible: checks.filter((entry) => entry.eligible).map((entry) => entry.subscription) },
        { headers: { "Cache-Control": "no-store" } });
    } catch {
      return new Response(null, { status: 503 });
    }
  }
  if (action === "webhook") {
    try {
      return await webhook(request);
    } catch {
      return new Response(null, { status: 503 });
    }
  }
  if (request.headers.get("origin") !== appOrigin(request)) return new Response(null, { status: 403 });
  try {
    const form = await request.formData();
    if (action === "subscribe") return await start(request, form);
    if (action === "email") {
      const email = String(form.get("email") ?? "").trim().toLowerCase();
      if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        // Keep the response and error path identical for registered and unknown addresses.
        try { await sendStartupSignIn(email, appOrigin(request)); } catch { /* email can be retried */ }
      }
      return go(request, "?status=sent");
    }
    if (action === "sign-in") {
      const link = await redeemStartupLink(String(form.get("token") ?? ""));
      return link ? await signedIn(request, link.subscription) : go(request, "?status=expired");
    }
    if (action === "unsubscribe") {
      const token = String(form.get("token") ?? "");
      const member = validToken(token) ? await (await startupMembers()).findOne({ newsletter_token: token, mode: paypalMode() }) : null;
      if (member) await (await startupMembers()).updateMany({ email: member.email, mode: paypalMode() }, { $set: { newsletter: false } });
      return go(request, "?status=unsubscribed");
    }
    if (action === "sign-out") {
      const token = request.cookies.get(sessionCookie)?.value ?? "";
      if (validToken(token)) await (await startupTokens("sessions")).deleteOne({ _id: tokenHash(token) });
      const response = go(request);
      response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    return new Response(null, { status: 404 });
  } catch {
    return go(request, "?status=unavailable");
  }
}
