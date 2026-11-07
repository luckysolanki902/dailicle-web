import { NextResponse } from "next/server";
import { subunitsToMajor } from "@/lib/pricing";
import { supportersCollection } from "@/lib/supporters";

export const runtime = "nodejs";

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

    const contributions = captured.map(({ day, country, currency, subunits }) => ({
      day,
      country: typeof country === "string" && /^[A-Z]{2}$/.test(country) && country !== "ZZ"
        ? country
        : null,
      currency,
      amount: subunitsToMajor(subunits, currency),
    }));

    return NextResponse.json({ contributions }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("support/public-feed error:", error);
    return NextResponse.json({ message: "Support feed is temporarily unavailable." }, { status: 503 });
  }
}
