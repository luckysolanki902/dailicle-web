import { createHash } from "crypto";
import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getClientCountry } from "@/lib/request";

/**
 * A quiet like/dislike signal per essay, deduped by IP so one visitor counts
 * once. We never surface the totals to readers — this exists purely to feed
 * the topic-generator pipeline a sense of which ideas land. The raw IP is
 * hashed before it touches the database.
 */
function hashIp(ip: string): string {
  const salt = process.env.REACTION_SALT || "dailicle-reactions";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

async function reactions() {
  const client = await clientPromise;
  return client.db("dailicle").collection("essay_reactions");
}

/** Returns this visitor's current vote for an essay: 1, -1, or 0. */
export async function GET(request: NextRequest) {
  const essayId = new URL(request.url).searchParams.get("essayId");
  if (!essayId) {
    return NextResponse.json({ value: 0 });
  }

  const ipHash = hashIp(getClientIp(request));
  const doc = await (await reactions()).findOne({ essayId, ipHash });
  return NextResponse.json({ value: doc?.value ?? 0 });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      essayId?: unknown;
      value?: unknown;
    } | null;

    const essayId = typeof body?.essayId === "string" ? body.essayId : "";
    const raw = body?.value;
    const value = raw === 1 || raw === -1 || raw === 0 ? raw : null;

    if (!essayId || value === null) {
      return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }

    const ipHash = hashIp(getClientIp(request));
    const col = await reactions();

    // 0 means the visitor toggled their vote back off.
    if (value === 0) {
      await col.deleteOne({ essayId, ipHash });
      return NextResponse.json({ success: true, value: 0 });
    }

    await col.updateOne(
      { essayId, ipHash },
      {
        $set: {
          value,
          country: getClientCountry(request),
          updatedAt: new Date(),
        },
        $setOnInsert: { essayId, ipHash, createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, value });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
