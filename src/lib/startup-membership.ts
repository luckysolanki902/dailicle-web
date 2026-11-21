import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import client from "@/lib/mongodb";
import { hasPublishedMembersEssay } from "@/lib/startup-essays";
import { getPaypalStartupPlan, getPaypalStartupSubscription, getPaypalStartupTransactions, isLive, paypalConfigured } from "@/lib/paypal";

export const sessionCookie = "dailicle-startup-session";
export const checkoutCookie = "dailicle-startup-checkout";
export const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const;
export const newToken = () => randomBytes(24).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const validToken = (value: string) => /^[\w-]{32}$/.test(value);
export const validSubscription = (value: string) => /^I-[A-Z0-9]{6,32}$/.test(value);
export const planId = () => process.env.PAYPAL_STARTUP_PLAN_ID || "";
export const mailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
export const membershipEnabled = () => Boolean(planId() && process.env.PAYPAL_STARTUP_WEBHOOK_ID && paypalConfigured() && mailConfigured());
const mode = () => isLive() ? "live" : "sandbox";

type Member = { _id: string; subscription: string; email: string; mode: string; newsletter?: boolean; newsletter_token?: string };
type Token = { _id: string; subscription: string; mode: string; expires: Date };
const db = async () => (await client).db("dailicle");
export const startupCheckouts = async () =>
  (await db()).collection<{ _id: string; mode: string; plan: string; subscription?: string; createdAt: Date; recoveryUntil: Date }>("startup_checkouts");
export const paypalMode = mode;
export const startupMembers = async () => (await db()).collection<Member>("startup_members");
export const startupTokens = async (kind: "sessions" | "links") =>
  (await db()).collection<Token>(`startup_${kind}`);

export async function startupOffer() {
  if (!membershipEnabled() || (isLive() && !await hasPublishedMembersEssay())) return null;
  const plan = await getPaypalStartupPlan(planId());
  const cycles = plan.billing_cycles as { tenure_type: string; total_cycles: number; frequency: { interval_unit: string; interval_count: number }; pricing_scheme: { fixed_price?: { currency_code: string; value: string } } }[] | undefined;
  const cycle = cycles?.[0];
  const price = cycle?.pricing_scheme?.fixed_price;
  const preferences = plan.payment_preferences as { setup_fee?: { value: string } } | undefined;
  if (plan.status !== "ACTIVE" || cycles?.length !== 1 || cycle?.tenure_type !== "REGULAR" ||
      cycle.total_cycles !== 0 || cycle.frequency?.interval_unit !== "MONTH" ||
      cycle.frequency.interval_count !== 1 || !price || !(Number(price.value) > 0) ||
      Number(preferences?.setup_fee?.value ?? 0) !== 0 || Number((plan.taxes as { percentage?: string })?.percentage ?? 0) !== 0) {
    return null;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency_code, currencyDisplay: "code" }).format(Number(price.value));
}

export async function createSession(subscription: string) {
  const token = newToken();
  const maxAge = 60 * 60 * 24 * 90;
  await (await startupTokens("sessions")).insertOne({ _id: tokenHash(token), subscription, mode: mode(), expires: new Date(Date.now() + maxAge * 1000) });
  return { token, maxAge };
}

export async function currentSubscription() {
  const token = (await cookies()).get(sessionCookie)?.value ?? "";
  if (!validToken(token)) return null;
  const row = await (await startupTokens("sessions")).findOne({ _id: tokenHash(token), mode: mode(), expires: { $gt: new Date() } });
  return row?.subscription ?? null;
}

export async function registerStartupMember(id: string, state: string) {
  const subscription = await getPaypalStartupSubscription(id);
  const checkout = await (await startupCheckouts()).findOne({ _id: tokenHash(state), mode: mode(), recoveryUntil: { $gt: new Date() } });
  if (!checkout || (checkout.subscription && checkout.subscription !== id) ||
      subscription.id !== id || subscription.plan_id !== checkout.plan || subscription.custom_id !== state ||
      !["ACTIVE", "APPROVED"].includes(String(subscription.status))) return false;
  const email = (subscription.subscriber as { email_address?: string } | undefined)?.email_address?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  await (await startupMembers()).updateOne(
    { _id: `${mode()}:${id}` },
    { $setOnInsert: { subscription: id, mode: mode(), email } },
    { upsert: true },
  );
  return true;
}

export async function hasStartupAccess(id: string) {
  if (!validSubscription(id) || !paypalConfigured()) return false;
  const info = await getPaypalStartupSubscription(id);
  // This ID entered the session only after a checkout for the configured plan.
  if (info.id !== id || !["ACTIVE", "CANCELLED", "EXPIRED"].includes(String(info.status))) return false;
  const billing = info.billing_info as { last_payment?: { time: string; amount: { value: string; currency_code: string } }; next_billing_time?: string } | undefined;
  const lastPayment = billing?.last_payment;
  const paidAt = new Date(lastPayment?.time ?? "");
  const now = new Date();
  if (!lastPayment || !Number.isFinite(paidAt.getTime()) || paidAt > now || !(Number(lastPayment.amount?.value) > 0)) return false;

  const monthEnd = new Date(paidAt);
  const day = monthEnd.getUTCDate();
  monthEnd.setUTCDate(1);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() + 1, 0)).getUTCDate();
  monthEnd.setUTCDate(Math.min(day, lastDay));
  const nextBill = Date.parse(billing?.next_billing_time ?? "");
  const paidUntil = Number.isFinite(nextBill) && nextBill > paidAt.getTime()
    ? Math.min(nextBill, monthEnd.getTime()) : monthEnd.getTime();
  if (now.getTime() >= paidUntil) return false;

  const result = await getPaypalStartupTransactions(id, new Date(paidAt.getTime() - 300_000), now);
  const transactions = result.transactions as { status: string; time: string; amount_with_breakdown?: { gross_amount?: { value: string; currency_code: string } } }[] | undefined;
  const matching = (transactions ?? []).filter((transaction) => {
    const gross = transaction.amount_with_breakdown?.gross_amount;
    return Math.abs(Date.parse(transaction.time) - paidAt.getTime()) <= 300_000 &&
      gross?.currency_code === lastPayment.amount.currency_code &&
      Number(gross?.value) === Number(lastPayment.amount.value);
  });
  return matching.length === 1 && matching[0].status === "COMPLETED";
}

export async function sendStartupSignIn(email: string, origin: string) {
  if (!mailConfigured()) return;
  const members = await (await startupMembers()).find({ email, mode: mode() }).sort({ _id: -1 }).limit(12).toArray();
  let subscription: string | undefined;
  for (const member of members) {
    if (await hasStartupAccess(member.subscription)) {
      subscription = member.subscription;
      break;
    }
  }
  if (!subscription) return;
  const token = newToken();
  const links = await startupTokens("links");
  const now = new Date();
  // One email per membership per five-minute window.
  const throttle = (await db()).collection<{ _id: string; until: Date }>("startup_email_limits");
  const key = `${mode()}:${subscription}`;
  try {
    await throttle.updateOne({ _id: key, until: { $lte: now } }, { $set: { until: new Date(now.getTime() + 300_000) } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return;
    throw error;
  }
  await links.insertOne({ _id: tokenHash(token), subscription, mode: mode(), expires: new Date(now.getTime() + 900_000) });
  const url = new URL("/api/startups/sign-in", origin);
  url.hash = token;
  await nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }).sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Dailicle Startups sign-in link",
    text: `Open this link to sign in to Dailicle Startups. It expires in 15 minutes.\n\n${url}\n\nIf you didn't request this link, you can ignore this email.`,
  });
}

export async function redeemStartupLink(token: string) {
  if (!validToken(token)) return null;
  return (await startupTokens("links")).findOneAndDelete({ _id: tokenHash(token), mode: mode(), expires: { $gt: new Date() } });
}
