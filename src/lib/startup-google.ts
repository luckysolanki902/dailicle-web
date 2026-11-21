import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { queueStartupMail } from "@/lib/startup-mail";
import client from "@/lib/mongodb";
import { cookieOptions, newToken, tokenHash, validToken } from "@/lib/startup-membership";

export const accountCookie = "dailicle-startup-google-session";
export const oauthCookie = "dailicle-startup-google-attempt";
const maxAge = 60 * 60 * 24 * 30;
export type StartupAccount = { subject: string; email: string; name?: string };
type GoogleSession = StartupAccount & { _id: string; expires: Date };
type OAuthAttempt = { _id: string; state: string; verifier: string; returnTo?: string; expires: Date };
const sessions = async () => (await client).db("dailicle").collection<GoogleSession>("startup_google_sessions");
const attempts = async () => (await client).db("dailicle").collection<OAuthAttempt>("startup_google_attempts");
const googleClientId = () => process.env.STARTUPS_GOOGLE_CLIENT_ID?.trim() ?? "";
const googleClientSecret = () => process.env.STARTUPS_GOOGLE_CLIENT_SECRET?.trim() ?? "";
export const googleConfigured = () => Boolean(googleClientId() && googleClientSecret());

export const currentStartupAccount = cache(async (): Promise<StartupAccount | null> => {
  const token = (await cookies()).get(accountCookie)?.value ?? "";
  if (!validToken(token)) return null;
  const session = await (await sessions()).findOne({ _id: tokenHash(token), expires: { $gt: new Date() } });
  return session ? { subject: session.subject, email: session.email, name: session.name } : null;
});

export async function clearStartupAccount(token: string) {
  if (validToken(token)) await (await sessions()).deleteOne({ _id: tokenHash(token) });
}

export async function beginGoogleSignIn(callback: string, returnTo?: string) {
  const attempt = newToken();
  const state = newToken();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  await (await attempts()).insertOne({ _id: tokenHash(attempt), state, verifier, returnTo, expires: new Date(Date.now() + 600_000) });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    response_type: "code", client_id: googleClientId(),
    redirect_uri: callback, scope: "openid email profile",
    state, code_challenge: challenge, code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url, attempt, options: { ...cookieOptions, maxAge: 600 } };
}

export async function finishGoogleSignIn(attempt: string, state: string, code: string, callback: string) {
  if (!validToken(attempt) || !validToken(state) || !code || code.length > 2048) return null;
  const pending = await (await attempts()).findOneAndDelete({ _id: tokenHash(attempt), state, expires: { $gt: new Date() } });
  if (!pending) return null;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(12_000),
    body: new URLSearchParams({
      code, code_verifier: pending.verifier, redirect_uri: callback, grant_type: "authorization_code",
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
    }),
  });
  if (!tokenResponse.ok) return null;
  const token = (await tokenResponse.json()).access_token;
  if (typeof token !== "string" || !token) return null;
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!profileResponse.ok) return null;
  const { sub, email, name, email_verified: verified } = await profileResponse.json();
  if (typeof sub !== "string" || !/^[\w-]{1,255}$/.test(sub) ||
      typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || verified !== true) return null;
  const displayName = typeof name === "string" ? name.trim().slice(0, 120) : "";
  const session = newToken();
  await (await sessions()).insertOne({
    _id: tokenHash(session), subject: sub, email: email.toLowerCase(), ...(displayName && { name: displayName }),
    expires: new Date(Date.now() + maxAge * 1000),
  });
  if (process.env.NODE_ENV === "production") {
    // Stable Google subject makes this a one-time welcome, even across devices.
    await queueStartupMail(`google:${tokenHash(sub)}`, "account", email.toLowerCase());
  }
  return { session, returnTo: pending.returnTo, options: { ...cookieOptions, maxAge } };
}
