/**
 * Server-side GA4 via the Measurement Protocol. Used to record events that must
 * not be lost to ad-blockers or a closed tab — above all, a *verified* payment.
 * Stitched to the reader's browser session by the GA client id captured at
 * checkout time. A pure no-op until GA_MEASUREMENT_ID + GA_API_SECRET are set,
 * so it is always safe to call.
 */

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";

export function gaConfigured(): boolean {
  return Boolean(process.env.GA_MEASUREMENT_ID && process.env.GA_API_SECRET);
}

export async function sendServerEvent(
  clientId: string,
  name: string,
  params: Record<string, string | number | boolean | undefined | null>
): Promise<void> {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret || !clientId) return;

  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    clean[k] = v;
  }

  try {
    await fetch(
      `${GA_ENDPOINT}?measurement_id=${encodeURIComponent(
        measurementId
      )}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          non_personalized_ads: false,
          events: [{ name, params: clean }],
        }),
      }
    );
  } catch (err) {
    console.error("ga mp send failed:", err);
  }
}
