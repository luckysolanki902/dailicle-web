import "server-only";
import { unstable_cache } from "next/cache";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

/**
 * "Read around the world" data: the top readerships by active users, pulled
 * from the GA4 Data API and cached for 24 hours. Auth uses the same service
 * account the admin uses, shipped as a base64 env var (GA_SA_KEY_B64) so
 * nothing hits disk. Every failure mode — missing creds, no data yet, an API
 * hiccup — degrades to an empty array so the landing page never breaks.
 */

export interface ReaderCountry {
  name: string;
  flag: string;
  /** Active users in the window. Only the ordering and ratios are shown. */
  share: number;
}

const PROPERTY = `properties/${process.env.GA_PROPERTY_ID || ""}`;
const WINDOW_DAYS = 365; // a year of readership, so the long tail is real
const TOP_N = 12;

let client: BetaAnalyticsDataClient | null = null;
function ga(): BetaAnalyticsDataClient | null {
  if (client) return client;
  const b64 = process.env.GA_SA_KEY_B64;
  if (!b64 || !process.env.GA_PROPERTY_ID) return null;
  try {
    const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
      projectId: creds.project_id,
    });
    return client;
  } catch {
    return null;
  }
}

/** ISO 3166-1 alpha-2 code → flag emoji, or "" when the code isn't usable. */
function flagOf(countryId: string): string {
  if (!countryId || countryId.length !== 2 || !/^[A-Za-z]{2}$/.test(countryId)) {
    return "";
  }
  const A = 0x1f1e6;
  const cc = countryId.toUpperCase();
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

async function fetchReadersByCountry(): Promise<ReaderCountry[]> {
  const c = ga();
  if (!c) return [];
  try {
    const [res] = await c.runReport({
      property: PROPERTY,
      dateRanges: [{ startDate: `${WINDOW_DAYS}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "country" }, { name: "countryId" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: TOP_N,
    });

    return (res.rows || [])
      .map((r) => ({
        name: r.dimensionValues?.[0]?.value || "",
        countryId: r.dimensionValues?.[1]?.value || "",
        share: Number(r.metricValues?.[0]?.value || 0),
      }))
      .filter(
        (r) => r.name && r.name !== "(not set)" && r.share > 0
      )
      .map((r) => ({ name: r.name, flag: flagOf(r.countryId), share: r.share }));
  } catch {
    return [];
  }
}

/**
 * Cached for 24h across all requests. The value is identical for every reader
 * and shifts glacially, so one GA call per day is plenty. Revalidate on demand
 * with the "readers-by-country" tag if ever needed.
 */
export const getReadersByCountry = unstable_cache(
  fetchReadersByCountry,
  ["readers-by-country"],
  { revalidate: 86400, tags: ["readers-by-country"] }
);
