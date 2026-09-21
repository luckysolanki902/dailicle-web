import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Unsubscribe by email address.
 *
 * Flips `status` to "unsubscribed" rather than deleting the document, because
 * the row is also the record of *not* to mail this person again — a delete
 * would let the same address be re-added silently by an old import and start
 * receiving Mondays once more. `services/subscribers_repo.py` on the server
 * selects on `status: {$in: ["subscribed", null]}`, so flipping the field is
 * all it takes for every send path to skip them.
 *
 * The response is deliberately identical whether or not the address is on the
 * list. A different message for "not found" would turn this open endpoint into
 * a way to test whether a given person subscribes to The Dailicle.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
    } | null;
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !emailPattern.test(email)) {
      return NextResponse.json(
        { message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("dailicle");
    const subscribers = db.collection("subscribers");

    await subscribers.updateOne(
      { email },
      {
        $set: {
          status: "unsubscribed",
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

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
