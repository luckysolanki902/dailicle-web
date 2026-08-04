"use client";

/**
 * First-party reader journey tracking.
 *
 * GA answers "how many"; this answers "who, and what did *they* do before they
 * paid". Every browser gets a random, anonymous visitor id (no name, no email,
 * nothing derived from the person) kept in localStorage. Against that id we
 * accumulate: where they first landed, which essays they opened, how long they
 * were actually *reading* each one, and the milestones on the way to a payment.
 * The support flow sends the same id with the order, which is what lets the
 * admin show a supporter's whole path instead of a lone row in a ledger.
 *
 * Everything is best-effort and non-blocking: a blocked beacon, a private
 * window with no storage, or a closed tab all degrade to "we know less", never
 * to a broken page.
 */

const VID_KEY = "dailicle:vid";
const SID_KEY = "dailicle:sid";
const ENDPOINT = "/api/journey";

/** Segments shorter than this are noise (a redirect, a mis-tap). */
const MIN_SEGMENT_SEC = 3;
/** Active time is sampled, not measured continuously. */
const TICK_MS = 5000;
/** Idle batches are flushed on this cadence. */
const FLUSH_MS = 20000;

export type JourneyEventType =
  | "page"
  | "support_open"
  | "checkout_start"
  | "checkout_dismiss"
  | "payment_success"
  | "subscribe";

interface JourneyEvent {
  type: JourneyEventType;
  at: number;
  path?: string;
  essayId?: string;
  title?: string;
  category?: string;
  /** Active (tab-visible) seconds, `page` events only. */
  seconds?: number;
  maxScroll?: number;
  source?: string;
}

interface Entry {
  path: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

interface Segment {
  path: string;
  activeMs: number;
  lastTick: number;
  maxScroll: number;
  essayId?: string;
  title?: string;
  category?: string;
}

let vid = "";
let sid = "";
let newSession = false;
let entry: Entry | null = null;
let queue: JourneyEvent[] = [];
let segment: Segment | null = null;
let ticker: number | null = null;
let flusher: number | null = null;
let started = false;

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function readStore(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStore(store: Storage | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Stable per-device id. Reused forever so returning readers stitch together. */
function visitorId(): string {
  if (typeof window === "undefined") return "";
  const ls = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  let id = readStore(ls, VID_KEY);
  if (!id) {
    id = uuid();
    writeStore(ls, VID_KEY, id);
  }
  return id;
}

/** Per-tab id. A new tab is a new session — good enough, and never wrong. */
function sessionId(): { id: string; fresh: boolean } {
  if (typeof window === "undefined") return { id: "", fresh: false };
  const ss = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();
  const existing = readStore(ss, SID_KEY);
  if (existing) return { id: existing, fresh: false };
  const id = uuid();
  writeStore(ss, SID_KEY, id);
  return { id, fresh: true };
}

/** The visitor id, for handing to the support order so the two can be joined. */
export function getVisitorId(): string {
  return vid || visitorId();
}

export function getJourneySessionId(): string {
  return sid;
}

function captureEntry(): Entry {
  const params = new URLSearchParams(window.location.search);
  const ref = document.referrer || "";
  return {
    path: window.location.pathname,
    // Self-referrals are navigation, not acquisition.
    referrer: ref && !ref.startsWith(window.location.origin) ? ref.slice(0, 300) : null,
    utmSource: params.get("utm_source")?.slice(0, 80) || null,
    utmMedium: params.get("utm_medium")?.slice(0, 80) || null,
    utmCampaign: params.get("utm_campaign")?.slice(0, 80) || null,
  };
}

/* ------------------------------------------------------------------ send */

function payload() {
  return {
    vid,
    sid,
    newSession,
    entry,
    events: queue,
  };
}

/**
 * Ship whatever is queued. `final` is used when the page is going away, where
 * only sendBeacon is reliable — fetch (even with keepalive) is routinely
 * cancelled on unload.
 */
function send(final = false): void {
  if (!vid || queue.length === 0) return;
  const body = JSON.stringify(payload());
  queue = [];
  // The entry + session flags only need to reach the server once; after the
  // first successful hand-off they're redundant (the server ignores repeats,
  // but there's no reason to keep paying for the bytes).
  newSession = false;

  try {
    if (final && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

function enqueue(event: JourneyEvent, immediate = false): void {
  if (!vid) return;
  queue.push(event);
  // Never let a pathological session grow the batch without bound.
  if (queue.length > 40) queue = queue.slice(-40);
  if (immediate) send();
}

/* -------------------------------------------------------------- segments */

function tick(): void {
  if (!segment) return;
  const now = Date.now();
  if (document.visibilityState === "visible") {
    segment.activeMs += now - segment.lastTick;
  }
  segment.lastTick = now;
}

function closeSegment(): void {
  if (!segment) return;
  tick();
  const seconds = Math.round(segment.activeMs / 1000);
  if (seconds >= MIN_SEGMENT_SEC) {
    enqueue({
      type: "page",
      at: Date.now(),
      path: segment.path,
      essayId: segment.essayId,
      title: segment.title,
      category: segment.category,
      seconds: Math.min(seconds, 3600),
      maxScroll: segment.maxScroll,
    });
  }
  segment = null;
}

function openSegment(path: string): void {
  segment = {
    path,
    activeMs: 0,
    lastTick: Date.now(),
    maxScroll: 0,
  };
}

function onScroll(): void {
  if (!segment) return;
  const doc = document.documentElement;
  const total = doc.scrollHeight - window.innerHeight;
  const pct =
    total > 0 ? Math.min(100, Math.round((window.scrollY / total) * 100)) : 100;
  if (pct > segment.maxScroll) segment.maxScroll = pct;
}

function onVisibility(): void {
  // Sample before the tab goes quiet, then push what we have — a tab that is
  // hidden may never come back.
  tick();
  if (document.visibilityState === "hidden") {
    closeSegment();
    send(true);
    openSegment(window.location.pathname);
  }
}

function onPageHide(): void {
  closeSegment();
  send(true);
}

/* ----------------------------------------------------------------- public */

/** Start tracking. Safe to call more than once; only the first call counts. */
export function initJourney(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  vid = visitorId();
  const session = sessionId();
  sid = session.id;
  newSession = session.fresh;
  entry = captureEntry();

  openSegment(window.location.pathname);

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  ticker = window.setInterval(tick, TICK_MS);
  flusher = window.setInterval(() => send(), FLUSH_MS);
  onScroll();
}

export function stopJourney(): void {
  if (!started) return;
  started = false;
  closeSegment();
  send(true);
  window.removeEventListener("scroll", onScroll);
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("pagehide", onPageHide);
  if (ticker) window.clearInterval(ticker);
  if (flusher) window.clearInterval(flusher);
  ticker = null;
  flusher = null;
}

/** Close out the previous page's dwell and begin timing the new one. */
export function journeyRouteChange(path: string): void {
  if (!started) return;
  closeSegment();
  openSegment(path);
  onScroll();
}

/**
 * Name the essay being read. Called by the reader as soon as it knows, because
 * by the time a route change flushes the segment the reader has already
 * unmounted and the global "current essay" pointer is gone.
 */
export function journeyEssay(
  essay: { id: string; title: string; category: string } | null
): void {
  if (!started || !segment || !essay) return;
  segment.essayId = essay.id;
  segment.title = essay.title.slice(0, 200);
  segment.category = essay.category;
}

/** A milestone worth putting on the timeline. Sent right away. */
export function journeyEvent(
  type: Exclude<JourneyEventType, "page">,
  params: { source?: string; essayId?: string; title?: string; category?: string } = {}
): void {
  if (!started) return;
  enqueue(
    {
      type,
      at: Date.now(),
      path: window.location.pathname,
      ...params,
    },
    true
  );
}
