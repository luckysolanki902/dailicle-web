import { MetadataRoute } from 'next'
import { getAllReadable } from '@/lib/essays'
import { LOCALE_CODES, localeUrl, hreflangAlternates } from '@/i18n/config'

/**
 * A localized sitemap: every page is emitted once per locale (its own <url>),
 * and each entry carries the full hreflang alternates set so search engines can
 * map the language versions to one another. English lives at the unprefixed
 * URL; the others under /es, /de, ... (see i18n/config).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const essays = await getAllReadable()
  const latestEssayDate = essays[0]?.published_at
    ? new Date(essays[0].published_at)
    : new Date()

  const entries: MetadataRoute.Sitemap = []

  const push = (
    path: string,
    lastModified: Date,
    changeFrequency: 'weekly' | 'monthly' | 'yearly',
    priority: number
  ) => {
    const languages = hreflangAlternates(path)
    for (const code of LOCALE_CODES) {
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
      0.8
    )
  }

  return entries
}
