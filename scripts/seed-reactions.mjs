// Backfill the essay_reactions collection with synthetic likes for essays
// that predate the like/dislike feature. We have no real historical votes,
// so we approximate them from page views: likes ≈ round(views / 10).
//
// Every seeded vote is a normal reaction doc (value: 1) with a unique,
// deterministic ipHash and `seeded: true`, so it aggregates exactly like a
// real vote and can be removed in one query later:
//   db.essay_reactions.deleteMany({ seeded: true })
//
// Re-running is safe: it clears its own prior seed for each essay first.
//
// Usage:  node scripts/seed-reactions.mjs          (writes)
//         node scripts/seed-reactions.mjs --dry     (report only)

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");

// slug -> page views (from analytics). Add rows here as you get more data.
const VIEWS = {
  "the-fear-of-dying-before-you-become-yourself": 1395,
  "the-quiet-cruelty-of-keeping-someone-just-in-case": 11,
  "why-being-seen-clearly-can-feel-like-an-attack": 9,
  "in-praise-and-fear-of-middlemen-the-invisible-architects-of-everyday-life": 2,
};

// likes ≈ 10% of views. Tune the divisor here if you want a different rate.
const likesFromViews = (views) => Math.round(views / 10);

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

const seedHash = (slug, i) =>
  createHash("sha256").update(`seed:${slug}:${i}`).digest("hex");

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("dailicle");
  const essays = db.collection("essays");
  const reactions = db.collection("essay_reactions");

  await reactions.createIndex({ essayId: 1, ipHash: 1 }, { unique: true });

  let totalLikes = 0;
  const seededSlugs = new Set();

  for (const [slug, views] of Object.entries(VIEWS)) {
    const essay = await essays.findOne({ slug }, { projection: { _id: 1 } });
    if (!essay) {
      console.warn(`  ⚠ no essay found for slug "${slug}" — skipped`);
      continue;
    }
    const essayId = essay._id.toString();
    const likes = likesFromViews(views);
    seededSlugs.add(slug);
    totalLikes += likes;

    console.log(
      `  ${slug}\n    views ${views} → ${likes} like(s)`
    );
    if (DRY) continue;

    // Clear any prior seed for this essay, then insert the fresh count.
    await reactions.deleteMany({ essayId, seeded: true });
    if (likes > 0) {
      const now = new Date();
      const docs = Array.from({ length: likes }, (_, i) => ({
        essayId,
        ipHash: seedHash(slug, i),
        value: 1,
        country: null,
        seeded: true,
        source: "views-backfill",
        createdAt: now,
        updatedAt: now,
      }));
      await reactions.insertMany(docs, { ordered: false });
    }
  }

  // Surface listed essays that have no view data yet.
  const listed = await essays
    .find(
      { status: { $in: ["published", "archived"] } },
      { projection: { slug: 1 } }
    )
    .toArray();
  const missing = listed
    .map((e) => e.slug)
    .filter((s) => s && !seededSlugs.has(s));

  console.log(
    `\n${DRY ? "[dry run] " : ""}seeded ${totalLikes} like(s) across ${seededSlugs.size} essay(s).`
  );
  if (missing.length) {
    console.log(
      `\n${missing.length} listed essay(s) have no view data (left untouched):`
    );
    for (const s of missing) console.log(`  - ${s}`);
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
