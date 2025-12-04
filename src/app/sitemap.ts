import { MetadataRoute } from 'next'
import { getArticles } from '@/lib/articles'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dailicle.vercel.app'
  
  // Get all articles for sitemap - fetching more to ensure all articles are included
  const { articles } = await getArticles(1, 10000, '')
  
  // Static pages - only homepage and archive (removed manifesto and feedback)
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/manifesto`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.7,
    }
  ]
  
  // Dynamic article pages - all blog posts with proper metadata
  const articlePages: MetadataRoute.Sitemap = articles.map((article: {_id: string, date_str?: string, date?: Date}) => ({
    url: `${baseUrl}/read/${article._id}`,
    lastModified: article.date_str ? new Date(article.date_str) : (article.date || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
  
  return [...staticPages, ...articlePages]
}
