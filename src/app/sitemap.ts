import { MetadataRoute } from 'next'
import { getAllReadable, getTranslatedLocalesMap } from '@/lib/essays'
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  localeUrl,
  hreflangAlternates,
} from '@/i18n/config'

/**
 * A localized sitemap: a page is emitted once per locale it genuinely exists
 * in, and each entry carries the matching hreflang set so search engines can
 * map the language versions to one another. English lives at the unprefixed
 * URL; the others under /es, /de, ... (see i18n/config).
 *
 * Essays are gated on having a real translation. Listing all 11 locales for
 * every essay inflated this file ~10x with URLs that served English text under
 * a foreign prefix — duplicates that burn the crawl budget this site needs for
 * the English originals.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const essays = await getAllReadable()
  const translated = await getTranslatedLocalesMap(essays.map((e) => e._id))
  const latestEssayDate = essays[0]?.published_at
    ? new Date(essays[0].published_at)
    : new Date()

  const entries: MetadataRoute.Sitemap = []

  const push = (
    path: string,
    lastModified: Date,
    changeFrequency: 'weekly' | 'monthly' | 'yearly',
    priority: number,
    // Locales this path actually has content for. Defaults to all of them:
    // the static pages are fully covered by the message catalogs.
    available: readonly string[] = LOCALE_CODES
  ) => {
    const codes = [DEFAULT_LOCALE, ...available.filter((c) => c !== DEFAULT_LOCALE)]
    const languages = hreflangAlternates(path, codes)
    for (const code of codes) {
      entries.push({
        url: localeUrl(path, code),
        lastModified,
        changeFrequency,
        priority,
        alternates: { languages },
      })
    }
  }

  push('/', latestEssayDate, 'weekly', 1)
  push('/archive', latestEssayDate, 'weekly', 0.9)
  push('/manifesto', new Date('2026-07-04'), 'yearly', 0.7)
  push('/feedback', new Date('2026-07-04'), 'yearly', 0.3)

  for (const essay of essays) {
    push(
      `/read/${essay.slug || essay._id}`,
      essay.published_at ? new Date(essay.published_at) : new Date(),
      'monthly',
      0.8,
      translated.get(essay._id) ?? []
    )
  }

  return entries
}
