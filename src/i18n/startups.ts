const configured = process.env.NEXT_PUBLIC_STARTUPS_SITE_URL;
export const startupOrigin = configured ? new URL(configured).origin : "";

export function startupPath(slug?: string, locale = "en") {
  const language = slug && locale !== "en" ? `/${locale}` : "";
  const prefix = startupOrigin ? language : `${language}/startups`;
  return slug ? `${prefix}/${encodeURIComponent(slug)}` : prefix || "/";
}

export function startupHref(slug?: string, locale = "en") {
  return `${startupOrigin}${startupPath(slug, locale)}`;
}
