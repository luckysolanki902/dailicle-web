import { recordStartupFunnel, startupFunnel } from "@/lib/startup-funnel";
import { queueStartupMail, type StartupMailKind } from "@/lib/startup-mail";
import { accountCookie, beginGoogleSignIn, clearStartupAccount, currentStartupAccount, finishGoogleSignIn, googleConfigured, oauthCookie } from "@/lib/startup-google";
import { recordStartupReadership } from "@/lib/startup-readership";
import { timingSafeEqual } from "node:crypto";
import { startupOrigin, startupPath } from "@/i18n/startups";
import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/i18n/config";
import { createPaypalStartupSubscription, getPaypalStartupSubscription, isLive, verifyPaypalWebhook } from "@/lib/paypal";
import {
  checkoutCookie, cookieOptions, hasStartupAccess,
  newToken, paypalMode, planId, registerStartupMember, reserveStartupCheckoutState,
  startupCheckouts, startupMembers, startupOffer, subscriptionForAccount, tokenHash, validSubscription, validToken,
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

async function start(request: NextRequest, form: FormData) {
  const account = await currentStartupAccount();
  if (!account) return go(request, "?status=sign-in-required");
  if (!await startupOffer()) return go(request, "?status=unavailable");
  const id = await subscriptionForAccount(account.subject);
  if (id) {
    if (await hasStartupAccess(id)) return go(request);
    const subscription = await getPaypalStartupSubscription(id);
    if (["APPROVED", "ACTIVE", "SUSPENDED"].includes(String(subscription.status))) {
      return go(request, "?status=existing");
    }
  }
  const proposed = String(form.get("checkout") ?? "");
  if (!validToken(proposed)) return go(request, "?status=unavailable");
  const state = await reserveStartupCheckoutState(account.subject, proposed);
  if (!state) return go(request, "?status=unavailable");
  const now = new Date();
  const funnel = startupFunnel(request);
  const checkout = await startupCheckouts();
  const key = tokenHash(state);
  await checkout.updateOne(
    { _id: key },
    { $setOnInsert: { mode: paypalMode(), plan: planId(), googleSubject: account.subject, googleEmail: account.email, funnel: funnel.journey, createdAt: now, recoveryUntil: new Date(now.getTime() + 7 * 86400_000) } },
    { upsert: true },
  );
  const attempt = await checkout.findOne({ _id: key, googleSubject: account.subject, mode: paypalMode(), plan: planId(), createdAt: { $gt: new Date(now.getTime() - 3600_000) } });
  if (!attempt) return go(request, "?status=unavailable");
  const expectedHost = isLive() ? "www.paypal.com" : "www.sandbox.paypal.com";
  let approvalUrl = attempt.approvalUrl;
  if (!approvalUrl) {
    const origin = appOrigin(request);
    const data = await createPaypalStartupSubscription(planId(), state, `${origin}/api/startups/return`, `${origin}${startupPath()}?status=cancelled`);
    const subscription = String(data.id ?? "");
    const approve = (data.links as { rel: string; href: string }[] | undefined)?.find((link) => link.rel === "approve");
    if (!validSubscription(subscription) || !approve || new URL(approve.href).origin !== `https://${expectedHost}`) {
      return go(request, "?status=unavailable");
    }
    approvalUrl = approve.href;
    const saved = await checkout.updateOne(
      { _id: key, googleSubject: account.subject, $or: [{ subscription: { $exists: false } }, { subscription }] },
      { $set: { subscription, approvalUrl } },
    );
    if (!saved.matchedCount) return go(request, "?status=unavailable");
  }
  const target = new URL(approvalUrl);
  if (target.origin !== `https://${expectedHost}`) return go(request, "?status=unavailable");
  const response = NextResponse.redirect(target, 303);
  response.cookies.set(checkoutCookie, state, { ...cookieOptions, maxAge: 3600 });
  await recordStartupFunnel("checkout_started", attempt.funnel);
  return funnel.attach(response);
}

const billingMail: Readonly<Record<string, StartupMailKind>> = {
  "PAYMENT.SALE.COMPLETED": "payment",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "payment-failed",
  "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
  "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
  "BILLING.SUBSCRIPTION.EXPIRED": "expired",
  "PAYMENT.SALE.REFUNDED": "refund",
  "PAYMENT.SALE.REVERSED": "refund",
};

async function webhook(request: NextRequest) {
  const webhookId = process.env.PAYPAL_STARTUP_WEBHOOK_ID;
  if (!webhookId) return new Response(null, { status: 503 });
  const event = await request.json();
  const type = String(event.event_type ?? "");
  const kind = Object.hasOwn(billingMail, type) ? billingMail[type] : undefined;
  if (type !== "BILLING.SUBSCRIPTION.ACTIVATED" && !kind) return new Response(null, { status: 204 });
  if (!await verifyPaypalWebhook(request.headers, event, webhookId)) return new Response(null, { status: 400 });
  const id = String(type.startsWith("PAYMENT.") ? event.resource?.billing_agreement_id ?? "" : event.resource?.id ?? "");
  if (!validSubscription(id)) return new Response(null, { status: 204 });

  const members = await startupMembers();
  let member = await members.findOne({ _id: `${paypalMode()}:${id}` });
  if (!member) {
    const data = await getPaypalStartupSubscription(id);
    const state = String(data.custom_id ?? "");
    if (data.plan_id !== planId() || !validToken(state)) return new Response(null, { status: 204 });
    if (!await registerStartupMember(id, state)) return new Response(null, { status: 503 });
    member = await members.findOne({ _id: `${paypalMode()}:${id}` });
  }

  const eventId = String(event.id ?? "");
  if (type === "BILLING.SUBSCRIPTION.ACTIVATED") await recordStartupFunnel("paypal_approval", member?.funnel);
  if (kind && member && isLive() && /^[A-Z0-9-]{8,100}$/i.test(eventId)) {
    let template = kind;
    if (kind === "payment") {
      await members.updateOne({ _id: member._id, firstPaymentEvent: { $exists: false } },
        { $set: { firstPaymentEvent: eventId } });
      const paidMember = await members.findOne({ _id: member._id }, { projection: { firstPaymentEvent: 1 } });
      if (paidMember?.firstPaymentEvent !== eventId) template = "renewal";
      else await recordStartupFunnel("first_payment", member.funnel);
    }
    await queueStartupMail(`paypal:${eventId}`, template, member.email);
  }
  return new Response(null, { status: 204 });
}

export async function GET(request: NextRequest, { params }: Context) {
  const { action } = await params;
  if (action === "google-callback") {
    if (!googleConfigured()) return go(request, "?status=google-unavailable");
    try {
      const { searchParams } = request.nextUrl;
      const signIn = await finishGoogleSignIn(
        request.cookies.get(oauthCookie)?.value ?? "",
        searchParams.get("state") ?? "", searchParams.get("code") ?? "",
        `${appOrigin(request)}/api/startups/google-callback`,
      );
      if (!signIn) return go(request, "?status=google-failed");
      await clearStartupAccount(request.cookies.get(accountCookie)?.value ?? "");
      const response = signIn.returnTo === "archive"
        ? NextResponse.redirect(new URL(startupPath("archive"), appOrigin(request)), 303) : go(request);
      response.headers.set("Cache-Control", "private, no-store");
      response.cookies.set(accountCookie, signIn.session, signIn.options);
      response.cookies.set(oauthCookie, "", { ...cookieOptions, maxAge: 0 });
      response.cookies.set(checkoutCookie, "", { ...cookieOptions, maxAge: 0 });
      const funnel = startupFunnel(request);
      await recordStartupFunnel("google_signed_in", funnel.journey);
      return funnel.attach(response);
    } catch {
      return go(request, "?status=google-failed");
    }
  }
  if (action === "unsubscribe") {
    // The recovery token stays in the fragment and this page loads no third-party code.
    const nonce = newToken();
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Friday email preferences</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style nonce="${nonce}">body{color-scheme:light dark;font:1.1rem system-ui;margin:15vh auto;padding:0 1.5rem;max-width:32rem}button{font:inherit;padding:.65rem 1rem}</style>
      <h1>Stop the Friday email</h1>
      <form method="post"><input type="hidden" name="token"><button disabled>Unsubscribe from Friday emails</button></form>
      <p>Your paid membership continues.</p>
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
    const account = await currentStartupAccount();
    if (!account) return go(request, "?status=sign-in-required");
    const state = request.cookies.get(checkoutCookie)?.value ?? "";
    if (!validToken(state)) return go(request, "?status=pending");
    const attempt = await (await startupCheckouts()).findOne({ _id: tokenHash(state), googleSubject: account.subject, mode: paypalMode(), createdAt: { $gt: new Date(Date.now() - 3600_000) } });
    if (!attempt?.subscription || !await registerStartupMember(attempt.subscription, state)) return go(request, "?status=pending");
    const response = go(request);
    response.cookies.set(checkoutCookie, "", { ...cookieOptions, maxAge: 0 });
    await recordStartupFunnel("paypal_approval", attempt.funnel);
    return response;
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
    if (action === "funnel") {
      const payload = await request.json();
      const funnel = startupFunnel(request, payload?.source);
      await recordStartupFunnel("landing", funnel.journey);
      return funnel.attach(new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } }));
    }
    if (action === "readership") return await recordStartupReadership(request);
    if (action === "subscribe") return await start(request, await request.formData());
    if (action === "google") {
      if (!googleConfigured()) return go(request, "?status=google-unavailable");
      const signIn = await beginGoogleSignIn(`${appOrigin(request)}/api/startups/google-callback`, request.nextUrl.searchParams.get("next") === "archive" ? "archive" : undefined);
      const response = NextResponse.redirect(signIn.url, 303);
      response.headers.set("Cache-Control", "private, no-store");
      response.cookies.set(oauthCookie, signIn.attempt, signIn.options);
      const funnel = startupFunnel(request);
      await recordStartupFunnel("google_started", funnel.journey);
      return funnel.attach(response);
    }
    if (action === "unsubscribe") {
      const token = String((await request.formData()).get("token") ?? "");
      const member = validToken(token) ? await (await startupMembers()).findOne({ newsletter_token: token, mode: paypalMode() }) : null;
      if (member) await (await startupMembers()).updateMany({ email: member.email, mode: paypalMode() }, { $set: { newsletter: false } });
      return go(request, "?status=unsubscribed");
    }
    if (action === "sign-out") {
      await clearStartupAccount(request.cookies.get(accountCookie)?.value ?? "");
      const response = go(request);
      for (const name of [accountCookie, oauthCookie, checkoutCookie]) {
        response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
      }
      return response;
    }
    return new Response(null, { status: 404 });
  } catch {
    return go(request, "?status=unavailable");
  }
}
