import { NextResponse } from "next/server";
import { subunitsToMajor } from "@/lib/pricing";
import { supportersCollection } from "@/lib/supporters";

export const runtime = "nodejs";

async function usdRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(4_000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.result === "success" && data.base_code === "USD" && data.rates) {
        return data.rates;
      }
    }
  } catch {
    // The feed can still show payments originally made in USD.
  }
  return {};
}

export async function GET() {
  try {
    const collection = await supportersCollection();
    const captured = await collection.aggregate<{
      day: string;
      country?: string;
      currency: string;
      subunits: number;
    }>([
      { $match: { status: "captured" } },
      {
        $project: {
          country: 1,
          currency: { $ifNull: ["$currencyCaptured", "$currency"] },
          subunits: { $ifNull: ["$amountCaptured", "$amount"] },
          receivedAt: { $ifNull: ["$capturedAt", "$verifiedAt", "$createdAt"] },
        },
      },
      {
        $match: {
          currency: /^[A-Z]{3}$/,
          subunits: { $type: "number", $gt: 0 },
          receivedAt: { $type: "date" },
        },
      },
      { $sort: { receivedAt: -1, _id: -1 } },
      { $limit: 40 },
      {
        $project: {
          _id: 0,
          country: 1,
          currency: 1,
          subunits: 1,
          day: {
            $dateToString: {
              date: "$receivedAt",
              format: "%Y-%m-%d",
              timezone: "Asia/Kolkata",
            },
          },
        },
      },
    ]).toArray();

    const rates = captured.some(({ currency }) => currency !== "USD") ? await usdRates() : {};
    const contributions = captured.flatMap(({ day, country, currency, subunits }) => {
      const converted = currency !== "USD";
      const rate = converted ? rates[currency] : 1;
      if (!Number.isFinite(rate) || rate <= 0) return [];
      const amount = Math.round((subunitsToMajor(subunits, currency) / rate) * 100) / 100;
      return [{
        day,
        country: typeof country === "string" && /^[A-Z]{2}$/.test(country) && country !== "ZZ"
          ? country
          : null,
        currency: "USD" as const,
        amount,
        converted,
      }];
    });

    return NextResponse.json({ contributions }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("support/public-feed error:", error);
    return NextResponse.json({ message: "Support feed is temporarily unavailable." }, { status: 503 });
  }
}
