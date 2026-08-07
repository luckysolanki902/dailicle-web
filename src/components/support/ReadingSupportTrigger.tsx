"use client";

import { useEffect } from "react";
import { useSupport, SUPPORTED_KEY } from "./SupportProvider";
import { getVisitCount, getSessionEssayCount } from "@/lib/analytics";
import { shouldAutoOpenSupport, TRIGGER } from "@/lib/support-trigger";

/**
 * Opens the support dialog by itself, but only for a reader who actually looks
 * like a supporter.
 *
 * The previous rule was "three minutes on any essay". Measured over 57
 * visitors, that fired at 18 different readers and produced zero checkouts —
 * while the navbar button, seen by six people, produced four. Interrupting a
 * stranger mid-essay does not work, and the failure was not one of engagement:
 * the auto-prompted group had a *higher* median reading time (468s) than the
 * people who clicked the navbar (247s).
 *
 * What separated the readers who did start a checkout was that they had come
 * back. Every one of them was on their second-or-later session; every reader
 * the old trigger caught was in their first. Reciprocity accrues across visits,
 * not minutes. So the conditions below ask for a returning reader who has just
 * finished something, rather than a new one who has been on the page a while:
 *
 *   1. never for someone who has already given
 *   2. a returning reader — not their first session
 *   3. genuinely engaged this session (a second essay, or real time on this one)
 *   4. at the *end* of the essay, not partway through
 *   5. at most once a week, and never more than three times ever
 *
 * The result fires far less often. That is the point: the old trigger's 18
 * impressions were worth nothing, so trading volume for aim costs nothing.
 */

const PROMPTED_AT_KEY = "dailicle:supportPromptedAt";
const PROMPT_COUNT_KEY = "dailicle:supportPromptCount";

function num(key: string): number {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
}

export function ReadingSupportTrigger() {
  const { open, isOpen } = useSupport();

  useEffect(() => {
    // Read the "already paid" flag straight from localStorage rather than the
    // context value: this effect runs once on mount and the context's
    // hasSupported flips to true a tick later, so a paid reader could otherwise
    // still arm the timer. A supporter must NEVER see the auto dialog again.
    try {
      if (localStorage.getItem(SUPPORTED_KEY) === "1") return;
      if (num(PROMPT_COUNT_KEY) >= TRIGGER.maxPrompts) return;

      const last = num(PROMPTED_AT_KEY);
      if (last && Date.now() - last < TRIGGER.cooldownMs) return;
    } catch {
      /* storage unavailable — fall through and behave normally */
    }

    let elapsed = 0;
    let lastTick = Date.now();
    let maxScroll = 0;
    let fired = false;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      maxScroll = Math.max(maxScroll, window.scrollY / scrollable);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        lastTick = Date.now();
        return;
      }
      const now = Date.now();
      elapsed += now - lastTick;
      lastTick = now;

      if (fired || isOpen) return;

      // The visit count is read here rather than at mount: AnalyticsProvider
      // sits *after* {children} in the layout, so its bumpVisit() effect runs
      // after this component's. At mount a returning reader still reads their
      // previous count, which would bail one visit too early — every time.
      const verdict = shouldAutoOpenSupport({
        hasSupported: false, // guarded at mount, before the timer was armed
        visitCount: getVisitCount(),
        sessionEssays: getSessionEssayCount(),
        activeMs: elapsed,
        maxScroll,
        lastPromptedAt: num(PROMPTED_AT_KEY),
        promptCount: num(PROMPT_COUNT_KEY),
        now: Date.now(),
      });
      if (!verdict.show) return;

      fired = true;
      window.clearInterval(interval);
      try {
        localStorage.setItem(PROMPTED_AT_KEY, String(Date.now()));
        localStorage.setItem(
          PROMPT_COUNT_KEY,
          String(num(PROMPT_COUNT_KEY) + 1)
        );
      } catch {
        /* ignore */
      }
      open("reader");
    }, 2000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
    };
    // Intentionally run once per mount; open/isOpen are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
