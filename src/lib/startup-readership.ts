import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { startupListing } from "@/lib/startup-essays";
import { cookieOptions, currentSubscription, newToken, tokenHash, validToken } from "@/lib/startup-membership";

const cookie = "dailicle-startup-reader";
type Reader = { _id: string; issue: number; firstSeen: Date; likedAt?: Date };

export async function recordStartupReadership(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (typeof payload?.slug !== "string" || !/^[a-z0-9-]{1,100}$/.test(payload.slug) ||
      !["view", "like", "unlike"].includes(payload.action)) return new NextResponse(null, { status: 400 });
  const essay = await startupListing(payload.slug);
  if (!essay || (essay._id > 1 && !await currentSubscription())) return new NextResponse(null, { status: 404 });

  const existing = request.cookies.get(cookie)?.value ?? "";
  const established = validToken(existing);
  if (!established && payload.action !== "view") return new NextResponse(null, { status: 400 });
  const token = established ? existing : newToken();
  const id = tokenHash(`${essay._id}:${token}`);
  const collection = (await client).db("dailicle").collection<Reader>("startup_readership");
  const now = new Date();

  if (payload.action === "view") {
    await collection.updateOne({ _id: id }, { $setOnInsert: { issue: essay._id, firstSeen: now } }, { upsert: true });
  } else if (payload.action === "like") {
    await collection.updateOne({ _id: id, likedAt: { $exists: false } }, { $set: { likedAt: now } });
  } else {
    await collection.updateOne({ _id: id }, { $unset: { likedAt: "" } });
  }
  const reader = await collection.findOne({ _id: id }, { projection: { likedAt: 1 } });
  const response = NextResponse.json({ liked: Boolean(reader?.likedAt) }, { headers: { "Cache-Control": "no-store" } });
  if (!established) response.cookies.set(cookie, token, { ...cookieOptions, maxAge: 365 * 86400 });
  return response;
}
