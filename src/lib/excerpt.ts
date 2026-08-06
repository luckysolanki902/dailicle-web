/**
 * Plain-text opening of an essay, for the meta description.
 *
 * Search results and link previews should show what the essay actually says.
 * The hook is a teaser written to make you click, which reads as thin
 * boilerplate in a SERP snippet and gives Google nothing of the page's
 * substance to match against.
 *
 * Kept in its own module, with no imports, so it compiles standalone under
 * `npm run test:excerpt` the same way release.ts does.
 */

/** Google renders roughly this much of a description before truncating. */
export const META_DESCRIPTION_LIMIT = 160;

/**
 * Markdown → prose. Deliberately narrow: essay bodies are paragraphs with the
 * occasional heading, blockquote, emphasis or link, and anything unrecognised
 * is better left as literal text than mangled by a clever regex.
 */
function toPlainText(markdown: string): string {
  return (
    markdown
      // Fenced code and images carry nothing readable into a snippet.
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      // Links and inline code keep their text, lose their syntax.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      // Line-leading structure: headings, quotes, list bullets, thematic breaks.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s{0,3}[-*+]\s+/gm, "")
      .replace(/^\s{0,3}\d+\.\s+/gm, "")
      .replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, " ")
      // Emphasis markers, once the line-leading bullets above are gone.
      .replace(/(\*\*|__|\*|_|~~)/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * A period that closes a word rather than a sentence. Essays here open on a
 * scene often enough ("At 11:47 p.m., the kitchen light...") that without this
 * a snippet gets cut off mid-moment.
 */
const ABBREVIATION =
  /(?:\b(?:[ap]\.m|e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|No|cf|ca|approx|Inc|Ltd|Vol)|(?:^|\s)[A-Z])\.$/;

/**
 * Index of the last sentence-ending mark in `text`, or -1. The mark only counts
 * when whitespace or the end of the string follows it, which keeps "3.5" and
 * "dailicle.com" from reading as sentence ends.
 */
function lastSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (!".!?".includes(text[i])) continue;
    const next = text[i + 1];
    if (next !== undefined && !/\s/.test(next)) continue;
    if (text[i] === "." && ABBREVIATION.test(text.slice(0, i + 1))) continue;
    return i;
  }
  return -1;
}

/**
 * Cut to `limit` on a sentence boundary where one falls reasonably close to it,
 * otherwise on a word boundary with an ellipsis. A snippet that ends mid-clause
 * reads as broken; one that stops two sentences early wastes the space, hence
 * the 60% floor before we settle for the ellipsis.
 */
function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const window = text.slice(0, limit);

  const sentence = lastSentenceEnd(window);
  if (sentence >= Math.floor(limit * 0.6)) return window.slice(0, sentence + 1);

  // The ellipsis has to fit inside the limit too, so an unbroken run of text
  // longer than the whole window still leaves room for it.
  const word = window.lastIndexOf(" ");
  const cut = word > 0 ? window.slice(0, word) : window.slice(0, limit - 1);
  return `${cut.replace(/[\s,;:–-]+$/, "")}…`;
}

/**
 * The essay's own opening, trimmed to fit a meta description. Returns "" when
 * the body is missing or yields nothing usable, so callers can fall back.
 */
export function essayExcerpt(
  body: string | undefined | null,
  limit: number = META_DESCRIPTION_LIMIT
): string {
  if (!body) return "";
  const text = toPlainText(body);
  if (!text) return "";
  return clip(text, limit);
}
