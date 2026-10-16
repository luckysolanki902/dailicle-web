import { MetadataRoute } from 'next'
import { SITE_URL } from '@/i18n/config'

// Crawlers that fetch aggressively across all 12 locale variants of every
// essay but send no readers. Each crawl of an uncached variant forces an ISR
// regeneration, so they were a large, pure-cost share of our ISR writes. We
// ask them not to crawl; the search engines we actually want (Google, Bing)
// keep full access below.
const UNWANTED_BOTS = [
  'meta-externalagent',
  'FacebookBot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Amazonbot',
  'Bytespider',
  'CCBot',
  'Google-Extended',
  'PerplexityBot',
  'Applebot-Extended',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
      {
        userAgent: UNWANTED_BOTS,
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
