import { MetadataRoute } from 'next'
import { getAllReadable } from '@/lib/essays'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dailicle.com'

  const essays = await getAllReadable()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/manifesto`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.7,
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
