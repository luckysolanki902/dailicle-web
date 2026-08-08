import assert from "node:assert/strict";
import test from "node:test";
import {
  heroTitleClass,
  HERO_TITLE_STEPS,
  HERO_TITLE_SMALLEST,
} from "./title-size";

/** Real titles, so the steps are tuned against what actually ships. */
const SHORT = "Lust Is a Leash"; // 15
const MEDIUM = "Why Ordinary People Obey Absurd Rules"; // 37
const LONG = "When Public Outrage Is Really About Private Shame"; // 48
const LONGEST =
  "Why Three Days at Home Can Undo Ten Years of Growth and Then Some More"; // 69

test("a short title keeps the largest step", () => {
  assert.equal(heroTitleClass(SHORT), HERO_TITLE_STEPS[0].className);
});

test("the title that prompted this shrinks below the default step", () => {
  // The whole point: 48 characters must not render at the same size as 37.
  assert.equal(heroTitleClass(MEDIUM), HERO_TITLE_STEPS[1].className);
  assert.equal(heroTitleClass(LONG), HERO_TITLE_STEPS[2].className);
  assert.notEqual(heroTitleClass(LONG), heroTitleClass(MEDIUM));
});

test("anything past the last step lands on the floor", () => {
  assert.equal(heroTitleClass(LONGEST), HERO_TITLE_SMALLEST);
});

test("size never grows as a title gets longer", () => {
  const sizes = [SHORT, MEDIUM, LONG, LONGEST].map(heroTitleClass);
  const rank = (c: string) => {
    const i = HERO_TITLE_STEPS.findIndex((s) => s.className === c);
    return i === -1 ? HERO_TITLE_STEPS.length : i;
  };
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(
      rank(sizes[i]) >= rank(sizes[i - 1]),
      `step went back up between index ${i - 1} and ${i}`
    );
  }
});

test("whitespace does not push a title down a step", () => {
  assert.equal(heroTitleClass(`  ${SHORT}  `), heroTitleClass(SHORT));
});

test("boundaries land on the step they name, not the next one", () => {
  for (const step of HERO_TITLE_STEPS) {
    assert.equal(heroTitleClass("x".repeat(step.maxChars)), step.className);
  }
  const last = HERO_TITLE_STEPS[HERO_TITLE_STEPS.length - 1];
  assert.equal(
    heroTitleClass("x".repeat(last.maxChars + 1)),
    HERO_TITLE_SMALLEST
  );
});
