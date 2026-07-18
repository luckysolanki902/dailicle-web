"use client";

/**
 * Thin, safe wrapper over GA4 (gtag) + Microsoft Clarity. Everything here is a
 * no-op on the server or when the tags haven't loaded (ad-blockers, etc.), so
 * callers never have to guard. Event and param names use snake_case to match
 * GA4 conventions; the same event names are mirrored to Clarity so session
 * recordings can be filtered by what the reader actually did.
 */

export const GA_MEASUREMENT_ID = "G-X79NX0FTRG";

export type EventParams = Record<
  string,
  string | number | boolean | undefined | null
>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    /** Set by the reader so the support dialog can attribute itself. */
    __dailicleEssay?: CurrentEssay | null;
    /** Timestamp (ms) the current client route was entered. */
    __dailicleRouteAt?: number;
  }
}

function prune(params?: EventParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/** Fire a GA4 event and mark the same event on the Clarity session. */
export function track(event: string, params?: EventParams): void {
  if (typeof window === "undefined") return;
  const p = prune(params);
  try {
    window.gtag?.("event", event, p);
  } catch {
    /* ignore */
  }
  try {
    window.clarity?.("event", event);
  } catch {
    /* ignore */
  }
}

/** Attach a durable, filterable tag to the current Clarity session. */
export function clarityTag(key: string, value: string): void {
  if (typeof window === "undefined" || !value) return;
  try {
    window.clarity?.("set", key, value);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the GA client id so a later server-side event (a verified payment)
 * can be stitched to this same user/session. Resolves null if GA isn't present.
 */
export function getGaClientId(timeoutMs = 1000): Promise<string | null> {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      window.gtag!("get", GA_MEASUREMENT_ID, "client_id", (id: unknown) =>
        done(typeof id === "string" && id ? id : null)
      );
    } catch {
      done(null);
    }
    setTimeout(() => done(null), timeoutMs);
  });
}

/* --------------------------------------------------------------------------
 * Session / visit context used to answer "after how many visits and how much
 * time did they open the dialog / pay?" All best-effort, all client-only.
 * ------------------------------------------------------------------------ */

const VISIT_COUNT_KEY = "dailicle:visitCount";
const LAST_SEEN_KEY = "dailicle:lastSeenAt";
const SESSION_ESSAYS_KEY = "dailicle:sessionEssays";
const VISIT_GAP_MS = 30 * 60 * 1000; // a fresh visit after 30 min idle

function safeLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function safeSession(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Increment the visit counter once per session boundary. Returns the count. */
export function bumpVisit(): number {
  const ls = safeLocal();
  if (!ls) return 0;
  const now = Date.now();
  const last = Number(ls.getItem(LAST_SEEN_KEY) || 0);
  let count = Number(ls.getItem(VISIT_COUNT_KEY) || 0);
  if (!last || now - last > VISIT_GAP_MS) count += 1;
  ls.setItem(VISIT_COUNT_KEY, String(count));
  ls.setItem(LAST_SEEN_KEY, String(now));
  return count;
}

export function getVisitCount(): number {
  const ls = safeLocal();
  return ls ? Number(ls.getItem(VISIT_COUNT_KEY) || 0) : 0;
}

/** Record that an essay was read this session (deduped). */
export function markEssayRead(essayId: string): void {
  const ss = safeSession();
  if (!ss || !essayId) return;
  try {
    const set = new Set<string>(
      JSON.parse(ss.getItem(SESSION_ESSAYS_KEY) || "[]")
    );
    set.add(essayId);
    ss.setItem(SESSION_ESSAYS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function getSessionEssayCount(): number {
  const ss = safeSession();
  if (!ss) return 0;
  try {
    return (JSON.parse(ss.getItem(SESSION_ESSAYS_KEY) || "[]") as string[]).length;
  } catch {
    return 0;
  }
}

/* --------------------------------------------------------------------------
 * Current-essay pointer lets the globally-mounted support dialog know which
 * essay (and category) was on screen when it opened, without prop-drilling.
 * ------------------------------------------------------------------------ */

export interface CurrentEssay {
  id: string;
  category: string;
  categoryLabel: string;
  title: string;
}

export function setCurrentEssay(essay: CurrentEssay | null): void {
  if (typeof window === "undefined") return;
  window.__dailicleEssay = essay;
}

export function getCurrentEssay(): CurrentEssay | null {
  if (typeof window === "undefined") return null;
  return window.__dailicleEssay || null;
}

/** Seconds spent on the current client route (best-effort). */
export function getTimeOnPageSec(): number {
  if (typeof window === "undefined" || !window.__dailicleRouteAt) return 0;
  return Math.max(0, Math.round((Date.now() - window.__dailicleRouteAt) / 1000));
}

export function markRouteEntered(): void {
  if (typeof window === "undefined") return;
  window.__dailicleRouteAt = Date.now();
}
