import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import type { Collection, Document } from "mongodb";

/**
 * Unsubscribe by the token carried in the link we emailed.
 *
 * Identity lives in the link, not in a text field. An open "type any address"
 * form would let anyone unsubscribe anyone, so the only accepted input is the
 * opaque `unsubToken` written onto the subscriber document by the server when
 * it builds the email (see services/subscribers_repo.py). No token, no
 * unsubscribe.
 *
 * The token is a stored random value rather than an HMAC of the address, so
 * there is no shared secret to keep in sync between Render and Vercel — and a
 * token reveals nothing about the address it belongs to.
 *
 * GET  ?t=<token>  -> { valid, email: masked }   for the confirmation screen
 * POST { token }   -> performs the unsubscribe
 *
 * Deliberately no GET-triggered write: corporate mail scanners (Defender Safe
 * Links, Mimecast, Barracuda) fetch every URL in an email before the recipient
 * ever sees it, and a GET that unsubscribes would drop those readers silently.
 * The state change needs the POST that only a real click sends.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

async function subscribersCollection(): Promise<Collection<Document>> {
  const client = await clientPromise;
  return client.db("dailicle").collection("subscribers");
}

/** l•••y@gmail.com — enough to recognise your own address, not enough to learn someone else's. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  if (local.length <= 2) return `${local[0] ?? "•"}•••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const subscribers = await subscribersCollection();
    const sub = await subscribers.findOne(
      { unsubToken: token },
      { projection: { email: 1, status: 1 } }
    );

    if (!sub) return NextResponse.json({ valid: false }, { status: 200 });

    return NextResponse.json({
      valid: true,
      email: maskEmail(sub.email as string),
      alreadyUnsubscribed: sub.status === "unsubscribed",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
    } | null;
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json(
        { message: "This unsubscribe link isn't valid." },
        { status: 400 }
      );
    }

    const subscribers = await subscribersCollection();

    // Flips `status` rather than deleting: the document is also the record of
    // *not* to mail this person again, and every send path already selects on
    // status: {$in: ["subscribed", null]}.
    const result = await subscribers.updateOne(
      { unsubToken: token },
      {
        $set: {
          status: "unsubscribed",
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "This unsubscribe link isn't valid." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "You're unsubscribed. No more Monday emails.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
