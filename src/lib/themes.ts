/**
 * The five strands of The Dailicle. Single source of truth for the UI —
 * mirrors THEMES in the server's essays_repo.py.
 */
export const THEMES = [
  { slug: "psychology", label: "Psychology" },
  { slug: "philosophy", label: "Philosophy" },
  { slug: "perspectives", label: "Perspectives" },
  { slug: "life", label: "Life" },
  { slug: "money", label: "Money & Wealth" },
] as const;

export type ThemeSlug = (typeof THEMES)[number]["slug"];

export function themeLabel(slug: string | undefined): string {
  return THEMES.find((t) => t.slug === slug)?.label ?? "Perspectives";
}
