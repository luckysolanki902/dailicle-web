import { MetadataRoute } from 'next'
import { getAllReadable } from '@/lib/essays'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dailicle.com'

  const essays = await getAllReadable()
  const latestEssayDate = essays[0]?.published_at
    ? new Date(essays[0].published_at)
    : new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: latestEssayDate,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: latestEssayDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/manifesto`,
      lastModified: new Date('2026-07-04'),
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/feedback`,
      lastModified: new Date('2026-07-04'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const essayPages: MetadataRoute.Sitemap = essays.map((essay) => ({
    url: `${baseUrl}/read/${essay.slug || essay._id}`,
    lastModified: essay.published_at ? new Date(essay.published_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...essayPages]
}
