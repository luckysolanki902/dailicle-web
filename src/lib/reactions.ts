import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongodb";

/**
 * Like counts per essay, read from the same `essay_reactions` collection the
 * reader-facing thumbs write to (see api/reaction). One row per visitor per
 * essay, deduped by hashed IP, so a count here is a count of people.
 *
 * These totals stay out of the reader's view — the archive uses them only to
 * decide an *order*, never to print a number next to an essay. Showing counts
 * would turn a private nudge into a scoreboard, which is exactly what the
 * reaction bar was built to avoid.
 *
 * Cached across requests and locales: the value is identical for every reader
 * and the archive itself only revalidates hourly, so there is no reason to run
 * this aggregation once per locale per render.
 */
export const getLikeCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const client = await clientPromise;
    const rows = await client
      .db("dailicle")
      .collection("essay_reactions")
      .aggregate<{ _id: string; likes: number }>([
        { $match: { value: 1 } },
        { $group: { _id: "$essayId", likes: { $sum: 1 } } },
      ])
      .toArray();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (typeof row._id === "string") counts[row._id] = row.likes;
    }
    return counts;
  },
  ["essay-like-counts"],
  { revalidate: 3600, tags: ["essay-likes"] }
);
