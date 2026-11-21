import { createHash, randomBytes } from "node:crypto";
import type { Funnel } from "@/lib/startup-funnel";
import client from "@/lib/mongodb";
import { hasPublishedMembersEssay } from "@/lib/startup-essays";
import { getPaypalStartupPlan, getPaypalStartupSubscription, getPaypalStartupTransactions, isLive, paypalConfigured } from "@/lib/paypal";

export const checkoutCookie = "dailicle-startup-checkout";
export const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const;
export const newToken = () => randomBytes(24).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const validToken = (value: string) => /^[\w-]{32}$/.test(value);
export const validSubscription = (value: string) => /^I-[A-Z0-9]{6,32}$/.test(value);
export const planId = () => process.env.PAYPAL_STARTUP_PLAN_ID || "";
export const membershipEnabled = () => Boolean(planId() && process.env.PAYPAL_STARTUP_WEBHOOK_ID && paypalConfigured());
const mode = () => isLive() ? "live" : "sandbox";

type Member = { _id: string; subscription: string; email: string; mode: string; newsletter?: boolean; newsletter_token?: string; googleSubject?: string; joinedAt?: Date; firstPaymentEvent?: string; funnel?: Funnel };
const db = async () => (await client).db("dailicle");
export const startupCheckouts = async () =>
  (await db()).collection<{ _id: string; mode: string; plan: string; subscription?: string; approvalUrl?: string; createdAt: Date; recoveryUntil: Date; googleSubject: string; googleEmail: string; funnel?: Funnel }>("startup_checkouts");
export const paypalMode = mode;
export const startupMembers = async () => (await db()).collection<Member>("startup_members");
export async function reserveStartupCheckoutState(subject: string, newState: string) {
  const locks = (await db()).collection<{ _id: string; state: string; until: Date }>("startup_checkout_locks");
  const key = `${mode()}:${subject}`;
  const now = new Date();
  try {
    const reserved = await locks.findOneAndUpdate(
      { _id: key, until: { $lte: now } },
      { $set: { state: newState, until: new Date(now.getTime() + 3600_000) } },
      { upsert: true, returnDocument: "after" },
    );
    return reserved?.state ?? null;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const active = await locks.findOne({ _id: key, until: { $gt: now } });
    return active?.state ?? null;
  }
}

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

export async function subscriptionForAccount(subject: string) {
  const member = await (await startupMembers()).findOne({ googleSubject: subject, mode: mode() }, { sort: { joinedAt: -1 } });
  return member?.subscription ?? null;
}

export async function registerStartupMember(id: string, state: string) {
  const subscription = await getPaypalStartupSubscription(id);
  const checkout = await (await startupCheckouts()).findOne({ _id: tokenHash(state), mode: mode(), recoveryUntil: { $gt: new Date() } });
  if (!checkout || (checkout.subscription && checkout.subscription !== id) ||
      subscription.id !== id || subscription.plan_id !== checkout.plan || subscription.custom_id !== state ||
      !["ACTIVE", "APPROVED"].includes(String(subscription.status))) return false;
  if (!checkout.googleSubject || !checkout.googleEmail) return false;
  await (await startupMembers()).updateOne(
    { _id: `${mode()}:${id}`, googleSubject: checkout.googleSubject },
    { $setOnInsert: { subscription: id, mode: mode(), email: checkout.googleEmail,
                      googleSubject: checkout.googleSubject, joinedAt: new Date(), funnel: checkout.funnel } },
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
