import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getClientCountry } from "@/lib/request";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where the signup came from — mirrors the admin's SOURCE_LABELS so we can see
// which surface actually captures readers (footer vs. the essay page).
const ALLOWED_SOURCES = new Set(["navbar", "footer", "reader", "reader_inline", "dialog"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      source?: unknown;
    } | null;
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const source =
      typeof body?.source === "string" && ALLOWED_SOURCES.has(body.source)
        ? body.source
        : "footer";

    if (!email || !emailPattern.test(email)) {
      return NextResponse.json(
        { message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("dailicle");
    const subscribers = db.collection("subscribers");

    await subscribers.createIndex({ email: 1 }, { unique: true });

    const existingSubscriber = await subscribers.findOne({ email });

    if (existingSubscriber) {
      await subscribers.updateOne(
        { email },
        {
          $set: {
            lastSeenAt: new Date(),
            lastIp: getClientIp(request),
            lastCountry: getClientCountry(request),
            lastUserAgent: request.headers.get("user-agent") || "unknown",
          },
        }
      );

      return NextResponse.json(
        { message: "Already subscribed with this email." },
        { status: 409 }
      );
    }

    await subscribers.insertOne({
      email,
      ip: getClientIp(request),
      country: getClientCountry(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      referer: request.headers.get("referer") || null,
      source,
      status: "subscribed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Subscribed. See you on Monday.",
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { message: "Already subscribed with this email." },
        { status: 409 }
      );
    }

    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
