import { MetadataRoute } from 'next'
import { getArticles } from '@/lib/articles'
import { formatArticleDisplayDate } from '@/lib/utils'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dailicle.com'
  
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
  // Use the display date (which adds 1 day to account for overnight generation)
  const articlePages: MetadataRoute.Sitemap = articles.map((article: {_id: string, date_str?: string, date?: Date}) => {
    const displayDate = article.date 
      ? new Date(formatArticleDisplayDate(article.date, 'iso'))
      : new Date();
    
    return {
      url: `${baseUrl}/read/${article._id}`,
      lastModified: displayDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    };
  })
  
  return [...staticPages, ...articlePages]
}
