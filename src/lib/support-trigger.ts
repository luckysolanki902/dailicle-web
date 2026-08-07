/**
 * Whether the support dialog should open itself, as a pure decision.
 *
 * Extracted from the React component so the rule can be tested directly. The
 * component owns the timers, scroll listener and storage; this owns the
 * judgement, which is the part worth being sure about — an auto-opening modal
 * that fires on the wrong reader is worse than none, and the previous rule
 * ("three minutes on any essay") fired at 18 readers for zero checkouts.
 *
 * See ReadingSupportTrigger for the evidence behind each condition.
 */

export interface TriggerSignals {
  /** Has already given, on this device. */
  hasSupported: boolean;
  /** Sessions seen, per the 30-minute-gap visit counter. */
  visitCount: number;
  /** Distinct essays opened this session. */
  sessionEssays: number;
  /** Active (tab-visible) milliseconds on this essay. */
  activeMs: number;
  /** Deepest scroll reached, 0–1. */
  maxScroll: number;
  /** When we last auto-prompted, epoch ms, or 0. */
  lastPromptedAt: number;
  /** How many times we have auto-prompted, ever. */
  promptCount: number;
  now: number;
}

export const TRIGGER = {
  cooldownMs: 7 * 24 * 60 * 60 * 1000,
  maxPrompts: 3,
  minVisits: 2,
  minScroll: 0.8,
  minMs: 75 * 1000,
} as const;

export type TriggerVerdict =
  | { show: true }
  | { show: false; because: string };

export function shouldAutoOpenSupport(s: TriggerSignals): TriggerVerdict {
  if (s.hasSupported) return { show: false, because: "already-supported" };
  if (s.promptCount >= TRIGGER.maxPrompts) {
    return { show: false, because: "asked-enough" };
  }
  if (s.lastPromptedAt && s.now - s.lastPromptedAt < TRIGGER.cooldownMs) {
    return { show: false, because: "cooldown" };
  }
  if (s.visitCount < TRIGGER.minVisits) {
    return { show: false, because: "first-visit" };
  }

  const engaged = s.sessionEssays >= 2 || s.activeMs >= TRIGGER.minMs;
  if (!engaged) return { show: false, because: "not-engaged" };

  if (s.maxScroll < TRIGGER.minScroll) {
    return { show: false, because: "not-finished" };
  }
  return { show: true };
}
