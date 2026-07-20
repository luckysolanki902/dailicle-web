/**
 * The five strands of The Dailicle. Single source of truth for the UI –
 * mirrors THEMES in the server's essays_repo.py. A clean map of the human
 * condition: your mind, other people, existence, the world, what you chase.
 */
export const THEMES = [
  { slug: "psychology", label: "Psychology" },
  { slug: "relationships", label: "Relationships" },
  { slug: "philosophy", label: "Philosophy" },
  { slug: "society", label: "Society" },
  { slug: "money", label: "Money" },
] as const;

export type ThemeSlug = (typeof THEMES)[number]["slug"];

/**
 * Label for a theme slug. Falls back to a title-cased version of the slug so
 * legacy 2025 essays tagged with retired strands (perspectives, life) still
 * render a sensible label in the archive drawer.
 */
export function themeLabel(slug: string | undefined): string {
  if (!slug) return "Essay";
  const known = THEMES.find((t) => t.slug === slug);
  if (known) return known.label;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/**
 * Build a locale-aware theme labeller from a translator `t`. Uses the
 * "themes.<slug>" catalog key, falling back to the English label when the key
 * is missing (e.g. retired legacy strands). Works with both the server and
 * client `t`.
 */
export function makeThemeLabel(
  t: (key: string) => string
): (slug: string | undefined) => string {
  return (slug) => {
    if (!slug) return themeLabel(slug);
    const key = `themes.${slug}`;
    const translated = t(key);
    return translated === key ? themeLabel(slug) : translated;
  };
}
