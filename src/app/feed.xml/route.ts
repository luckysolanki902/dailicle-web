import { getPublishedEssays } from "@/lib/essays";
import { themeLabel } from "@/lib/themes";

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * RSS keeps the publication discoverable by readers, aggregators, and
 * search engines – the natural distribution channel for a weekly essay.
 */
export async function GET() {
  // Current era only – the feed is the publication, not the attic.
  const essays = await getPublishedEssays(60);

  const items = essays
    .map((essay) => {
      const url = `https://dailicle.com/read/${essay.slug || essay._id}`;
      const pubDate = essay.published_at
        ? new Date(essay.published_at).toUTCString()
        : new Date().toUTCString();
      return `    <item>
      <title>${escapeXml(essay.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(themeLabel(essay.theme))}</category>
      <description>${escapeXml(essay.hook || "")}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Dailicle</title>
    <link>https://dailicle.com</link>
    <atom:link href="https://dailicle.com/feed.xml" rel="self" type="application/rss+xml"/>
    <description>One essay a week on the mind, meaning, money, and how to live. Written to be read slowly.</description>
    <language>en-us</language>
    <ttl>1440</ttl>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
