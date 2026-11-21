import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { cookieOptions, newToken, tokenHash, validToken } from "@/lib/startup-membership";

export const funnelCookie = "dailicle-startup-visit";
const sourceCookie = "dailicle-startup-source";
type Source = "home" | "archive" | "direct";
type Stage = "landing" | "google_started" | "google_signed_in" | "checkout_started" | "paypal_approval" | "first_payment";
export type Funnel = { key: string; source: Source };
type Entry = { _id: string; stage: Stage; browser: string; source: Source; occurredAt: Date };

function source(value: unknown): Source {
  return value === "home" || value === "archive" ? value : "direct";
}

export function startupFunnel(request: NextRequest, initialSource?: unknown) {
  const existing = request.cookies.get(funnelCookie)?.value ?? "";
  const established = validToken(existing);
  const visit = established ? existing : newToken();
  const journey = { key: tokenHash(visit), source: source(request.cookies.get(sourceCookie)?.value ?? initialSource) };
  function attach(response: NextResponse) {
    if (!established) {
      response.cookies.set(funnelCookie, visit, { ...cookieOptions, maxAge: 90 * 86400 });
      response.cookies.set(sourceCookie, journey.source, { ...cookieOptions, maxAge: 90 * 86400 });
    }
    return response;
  }
  return { journey, attach };
}

export async function recordStartupFunnel(stage: Stage, journey?: Funnel) {
  if (!journey) return;
  try {
    const rows = (await client).db("dailicle").collection<Entry>("startup_funnel");
    await rows.updateOne({ _id: `${stage}:${journey.key}` }, { $setOnInsert: {
      stage, browser: journey.key, source: journey.source, occurredAt: new Date(),
    } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) console.warn("Startup funnel event could not be recorded:", stage);
  }
}
