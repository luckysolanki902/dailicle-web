import { NextRequest, NextResponse } from "next/server";
import type { AnyBulkWriteOperation, Document } from "mongodb";
import { getClientCountry } from "@/lib/request";
import { journeyDb, JOURNEY_EVENT_TYPES } from "@/lib/journey-store";

export const runtime = "nodejs";

/**
 * Reader-journey ingest. Called by `lib/journey.ts` — usually via sendBeacon,
 * which means: no response is ever read, and the browser will not retry. So
 * this endpoint is deliberately forgiving. Anything malformed is dropped and
 * the rest of the batch is still recorded; every reply is a bare 204 so a
 * blocked or failed beacon costs the reader nothing.
 */

const MAX_EVENTS = 40;
const MAX_SECONDS = 3600; // an hour on one page is already implausible
const EVENT_TYPES = new Set<string>(JOURNEY_EVENT_TYPES);

const ok = () => new NextResponse(null, { status: 204 });

/** Trim to a sane, length-capped string, or null. */
function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function int(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(max, Math.max(min, n));
}

/** Client clocks lie. Anything implausible falls back to server time. */
function when(v: unknown, now: number): Date {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  const skewed = n < now - 86400_000 || n > now + 300_000;
  return new Date(skewed ? now : n);
}

interface Incoming {
  type: string;
  at: unknown;
  path?: unknown;
  essayId?: unknown;
  title?: unknown;
  category?: unknown;
  seconds?: unknown;
  maxScroll?: unknown;
  source?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      vid?: unknown;
      sid?: unknown;
      newSession?: unknown;
      entry?: Record<string, unknown> | null;
      events?: unknown;
    } | null;

    const vid = str(body?.vid, 64);
    // Ids are minted by `crypto.randomUUID()`; anything else is not ours.
    if (!vid || vid.length < 8 || !/^[A-Za-z0-9-]+$/.test(vid)) return ok();

    const sid = str(body?.sid, 64);
    const events = Array.isArray(body?.events)
      ? (body.events as Incoming[]).slice(0, MAX_EVENTS)
      : [];
    if (events.length === 0) return ok();

    const now = Date.now();
    const nowDate = new Date(now);
    const country = getClientCountry(request);
    const db = await journeyDb();

    /* ---- per-page dwell + the timeline ---------------------------------- */

    const pageOps: AnyBulkWriteOperation<Document>[] = [];
    const timeline: Document[] = [];
    let addedSeconds = 0;
    let addedViews = 0;

    for (const e of events) {
      const type = typeof e?.type === "string" ? e.type : "";
      if (!EVENT_TYPES.has(type)) continue;

      const at = when(e.at, now);
      const path = str(e.path, 300);
      const essayId = str(e.essayId, 64);
      const title = str(e.title, 200);
      const category = str(e.category, 40);

      if (type === "page") {
        // An essay is keyed by its id so the same essay read in three
        // languages (three paths) still aggregates as one thing read.
        const key = essayId || path;
        if (!key) continue;
        const seconds = int(e.seconds, 0, MAX_SECONDS);
        const maxScroll = int(e.maxScroll, 0, 100);
        addedSeconds += seconds;
        addedViews += 1;

        pageOps.push({
          updateOne: {
            filter: { vid, key },
            update: {
              $setOnInsert: { vid, key, firstAt: at },
              $set: {
                kind: essayId ? "essay" : "page",
                path,
                essayId,
                ...(title ? { title } : {}),
                ...(category ? { category } : {}),
                lastAt: at,
              },
              $inc: { seconds, views: 1 },
              $max: { maxScroll },
            },
            upsert: true,
          },
        });
      }

      timeline.push({
        vid,
        sid,
        type,
        at,
        path,
        essayId,
        title,
        category,
        seconds: type === "page" ? int(e.seconds, 0, MAX_SECONDS) : null,
        maxScroll: type === "page" ? int(e.maxScroll, 0, 100) : null,
        source: str(e.source, 40),
      });
    }

    if (timeline.length === 0) return ok();

    /* ---- the visitor spine ---------------------------------------------- */

    const entry = body?.entry
      ? {
          path: str(body.entry.path, 300),
          referrer: str(body.entry.referrer, 300),
          utmSource: str(body.entry.utmSource, 80),
          utmMedium: str(body.entry.utmMedium, 80),
          utmCampaign: str(body.entry.utmCampaign, 80),
          at: nowDate,
        }
      : null;

    // The *first* essay of the batch is the best guess at what they landed on,
    // and only matters when this is the very first batch we've ever seen.
    const firstPage = events.find((e) => e?.type === "page");
    const entryDoc = entry
      ? {
          ...entry,
          essayId: str(firstPage?.essayId, 64),
          title: str(firstPage?.title, 200),
          category: str(firstPage?.category, 40),
        }
      : null;

    await Promise.all([
      db.collection("reader_journeys").updateOne(
        { vid },
        {
          $setOnInsert: {
            vid,
            firstSeenAt: nowDate,
            // `entry` is written once and never again — it is the acquisition
            // record. `lastEntry` below keeps the most recent one.
            ...(entryDoc ? { entry: entryDoc } : {}),
          },
          $set: {
            lastSeenAt: nowDate,
            lastSid: sid,
            ...(country ? { country } : {}),
            userAgent: request.headers.get("user-agent")?.slice(0, 300) || null,
            ...(entryDoc ? { lastEntry: entryDoc } : {}),
          },
          $inc: {
            sessions: body?.newSession === true ? 1 : 0,
            pageviews: addedViews,
            totalSeconds: addedSeconds,
          },
        },
        { upsert: true }
      ),
      pageOps.length ? db.collection("reader_page_time").bulkWrite(pageOps, { ordered: false }) : null,
      db.collection("reader_events").insertMany(timeline, { ordered: false }),
    ]);

    return ok();
  } catch (error) {
    console.error("journey ingest error:", error);
    // Still a 204: the reader gets nothing either way, and a 500 only invites
    // noisy client-side retries for data that is not worth one.
    return ok();
  }
}
