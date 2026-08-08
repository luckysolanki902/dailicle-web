/**
 * How big the hero title is allowed to get, as a function of how long it is.
 *
 * The hero is set in a display face at a size chosen to read as a front page,
 * which works until a title runs long: "When Public Outrage Is Really About
 * Private Shame" is 48 characters and at the top step it wraps to three lines
 * and pushes the hook, the CTA and the fold off the screen. Shrinking the type
 * as the title grows keeps the *block* roughly constant instead of the glyphs.
 *
 * Discrete steps rather than a fluid clamp: the steps carry three separate
 * breakpoint sizes each, and hand-picked pairs stay legible at every width in a
 * way a single interpolated value does not. The classes are written out in full
 * because Tailwind only emits what it can see as a literal string — building
 * them by interpolation would compile to nothing.
 *
 * Measured in characters, not words, because it is rendered width that
 * overflows and character count tracks that far more closely.
 */

export interface TitleStep {
  /** Longest title, in characters, that still gets this step. */
  maxChars: number;
  className: string;
}

/** Ordered shortest-title-first; the first step that fits wins. */
export const HERO_TITLE_STEPS: readonly TitleStep[] = [
  { maxChars: 26, className: "text-[3rem] md:text-7xl lg:text-[5rem]" },
  { maxChars: 40, className: "text-[2.6rem] md:text-6xl lg:text-[4.4rem]" },
  { maxChars: 56, className: "text-[2.25rem] md:text-5xl lg:text-[3.6rem]" },
];

/** The floor — anything longer than the last step lands here. */
export const HERO_TITLE_SMALLEST =
  "text-[1.95rem] md:text-[2.6rem] lg:text-[3.05rem]";

/**
 * Font-size classes for a hero title. Pure and synchronous so the server and
 * the client always agree — this runs inside a component that hydrates, and a
 * size that differed between the two would flash on load.
 */
export function heroTitleClass(title: string): string {
  const length = title.trim().length;
  for (const step of HERO_TITLE_STEPS) {
    if (length <= step.maxChars) return step.className;
  }
  return HERO_TITLE_SMALLEST;
}
