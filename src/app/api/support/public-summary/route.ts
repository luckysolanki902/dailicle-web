import { NextResponse } from "next/server";
import { subunitsToMajor } from "@/lib/pricing";
import { supportersCollection } from "@/lib/supporters";

export const runtime = "nodejs";

export async function GET() {
  try {
    const collection = await supportersCollection();
    const groups = await collection.aggregate<{
      _id: { currency: string; country: string | null };
      subunits: number;
    }>([
      { $match: { status: "captured" } },
      {
        $project: {
          country: 1,
          currency: { $ifNull: ["$currencyCaptured", "$currency"] },
          subunits: { $ifNull: ["$amountCaptured", "$amount"] },
        },
      },
      { $match: { currency: /^[A-Z]{3}$/, subunits: { $type: "number", $gt: 0 } } },
      { $group: { _id: { country: "$country", currency: "$currency" }, subunits: { $sum: "$subunits" } } },
      { $sort: { "_id.country": 1, "_id.currency": 1 } },
    ]).toArray();

    const totalSubunits = new Map<string, number>();
    const countries = [];
    for (const { _id: { country, currency }, subunits } of groups) {
      totalSubunits.set(currency, (totalSubunits.get(currency) ?? 0) + subunits);
      if (typeof country === "string" && /^[A-Z]{2}$/.test(country) && country !== "ZZ") {
        countries.push({ country, currency, amount: subunitsToMajor(subunits, currency) });
      }
    }
    const totals = Array.from(totalSubunits, ([currency, subunits]) => ({
      currency,
      amount: subunitsToMajor(subunits, currency),
    })).sort((a, b) => a.currency.localeCompare(b.currency));

    return NextResponse.json({ totals, countries }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("support/public-summary error:", error);
    return NextResponse.json({ message: "Support totals are temporarily unavailable." }, { status: 503 });
  }
}
