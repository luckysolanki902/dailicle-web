import test from "node:test";
import assert from "node:assert/strict";
import { essayExcerpt, META_DESCRIPTION_LIMIT } from "./excerpt";

const OPENING =
  "Every few months someone I know announces, often half-joking, that they're scared of dying.";

test("returns a short body unchanged", () => {
  assert.equal(essayExcerpt(OPENING), OPENING);
});

test("falls back to empty for a missing or blank body", () => {
  assert.equal(essayExcerpt(undefined), "");
  assert.equal(essayExcerpt(null), "");
  assert.equal(essayExcerpt(""), "");
  assert.equal(essayExcerpt("   \n\n  "), "");
});

test("strips markdown structure but keeps the prose", () => {
  const body = [
    "## The fear underneath",
    "",
    "> Some quoted line.",
    "",
    "It is **not** the *ending* they mind, but the [unfinished](/read/x) shape.",
  ].join("\n");

  assert.equal(
    essayExcerpt(body),
    "The fear underneath Some quoted line. It is not the ending they mind, but the unfinished shape."
  );
});

test("drops images, code fences and thematic breaks", () => {
  const body = "![banner](https://cdn/x.png)\n\n---\n\nPlain words.\n\n```\nconst x = 1;\n```";
  assert.equal(essayExcerpt(body), "Plain words.");
});

test("keeps list text without the bullets", () => {
  assert.equal(essayExcerpt("- first\n- second\n\n1. third"), "first second third");
});

test("cuts on a sentence boundary when one lands late enough", () => {
  const body = `${"a".repeat(100)}. ${"b".repeat(100)}.`;
  const out = essayExcerpt(body);
  assert.equal(out, `${"a".repeat(100)}.`);
  assert.ok(!out.endsWith("…"));
});

test("cuts on a word boundary with an ellipsis when no sentence end is close", () => {
  const body = `${"word ".repeat(60)}end.`;
  const out = essayExcerpt(body);
  assert.ok(out.length <= META_DESCRIPTION_LIMIT);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.endsWith(" …"));
});

test("never exceeds the limit", () => {
  const bodies = [
    "x".repeat(500),
    `${"word ".repeat(200)}`,
    `${"a".repeat(159)}. ${"b".repeat(200)}`,
    OPENING.repeat(10),
  ];
  for (const body of bodies) {
    assert.ok(essayExcerpt(body).length <= META_DESCRIPTION_LIMIT, body.slice(0, 20));
  }
});

test("does not treat decimals or domains as sentence ends", () => {
  const body = `${"a".repeat(90)} costs 3.5 at dailicle.com and then keeps going well past the limit with more words here`;
  const out = essayExcerpt(body);
  assert.ok(out.endsWith("…"), out);
});

test("does not end a snippet on an abbreviation", () => {
  const body = `At 11:47 p.m. ${"the kitchen light feels too bright ".repeat(6)}`;
  const out = essayExcerpt(body);
  assert.ok(!out.endsWith("p.m."), out);

  const initials = `Written by J. R. ${"someone with a long name ".repeat(8)}`;
  assert.ok(!essayExcerpt(initials).endsWith("R."), essayExcerpt(initials));
});

test("still ends on a genuine sentence after an abbreviation", () => {
  // The real sentence end has to sit past the 60% floor, or the ellipsis path
  // correctly wins instead.
  const sentence =
    "At 11:47 p.m. the light is still on in the kitchen and nobody in the apartment has moved an inch since the plates were cleared.";
  assert.equal(essayExcerpt(`${sentence} ${"x".repeat(200)}`), sentence);
});

test("respects an explicit limit", () => {
  assert.ok(essayExcerpt(OPENING, 20).length <= 20);
});
