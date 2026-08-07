import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoOpenSupport, TRIGGER, type TriggerSignals } from "./support-trigger";

const NOW = Date.parse("2026-08-07T10:00:00Z");

/** A returning reader who has just finished an essay — the one we want. */
function ideal(over: Partial<TriggerSignals> = {}): TriggerSignals {
  return {
    hasSupported: false,
    visitCount: 2,
    sessionEssays: 1,
    activeMs: 120_000,
    maxScroll: 0.92,
    lastPromptedAt: 0,
    promptCount: 0,
    now: NOW,
    ...over,
  };
}

const why = (s: TriggerSignals): string => {
  const v = shouldAutoOpenSupport(s);
  return v.show === true ? "shown" : v.because;
};

test("a returning reader who finished the essay is asked", () => {
  assert.deepEqual(shouldAutoOpenSupport(ideal()), { show: true });
});

test("a supporter is never asked again", () => {
  assert.equal(why(ideal({ hasSupported: true })), "already-supported");
  // Not even if every other signal is perfect and the cooldown lapsed.
  assert.equal(
    why(ideal({ hasSupported: true, lastPromptedAt: 0, visitCount: 99 })),
    "already-supported"
  );
});

test("a first-session reader is never interrupted", () => {
  // This is the case the old three-minute rule caught 18 times, for nothing:
  // deeply engaged, finished the essay, but it's their first visit.
  assert.equal(
    why(ideal({ visitCount: 1, activeMs: 900_000, maxScroll: 1 })),
    "first-visit"
  );
});

test("engagement can come from time or from a second essay", () => {
  // Barely any time on this page, but they came back for another essay.
  assert.equal(why(ideal({ activeMs: 5_000, sessionEssays: 2 })), "shown");
  // One essay, but real time on it.
  assert.equal(why(ideal({ activeMs: TRIGGER.minMs, sessionEssays: 1 })), "shown");
  // Neither.
  assert.equal(
    why(ideal({ activeMs: TRIGGER.minMs - 1, sessionEssays: 1 })),
    "not-engaged"
  );
});

test("nobody is asked mid-essay", () => {
  // The heart of the change: engagement alone is not enough, they must have
  // reached the end. Interrupting a paragraph is what made it an intrusion.
  assert.equal(why(ideal({ maxScroll: 0.5 })), "not-finished");
  assert.equal(why(ideal({ maxScroll: TRIGGER.minScroll - 0.01 })), "not-finished");
  assert.equal(why(ideal({ maxScroll: TRIGGER.minScroll })), "shown");
});

test("the ask is capped: once a week, three times ever", () => {
  const dayAgo = NOW - 24 * 60 * 60 * 1000;
  assert.equal(why(ideal({ lastPromptedAt: dayAgo })), "cooldown");

  const eightDaysAgo = NOW - 8 * 24 * 60 * 60 * 1000;
  assert.equal(why(ideal({ lastPromptedAt: eightDaysAgo })), "shown");

  // Three refusals is an answer.
  assert.equal(
    why(ideal({ promptCount: TRIGGER.maxPrompts, lastPromptedAt: eightDaysAgo })),
    "asked-enough"
  );
  assert.equal(
    why(ideal({ promptCount: TRIGGER.maxPrompts - 1, lastPromptedAt: eightDaysAgo })),
    "shown"
  );
});

test("the cooldown boundary is exact", () => {
  const justInside = NOW - TRIGGER.cooldownMs + 1;
  const exactly = NOW - TRIGGER.cooldownMs;
  assert.equal(why(ideal({ lastPromptedAt: justInside })), "cooldown");
  assert.equal(why(ideal({ lastPromptedAt: exactly })), "shown");
});

test("the old rule's reader would no longer be interrupted", () => {
  // Exactly what the old trigger fired on: first visit, three minutes in,
  // halfway down the page. 18 of these produced zero checkouts.
  assert.equal(
    why(ideal({ visitCount: 1, activeMs: 180_000, maxScroll: 0.45 })),
    "first-visit"
  );
});
