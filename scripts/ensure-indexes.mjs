// One-time (idempotent) index setup for the web app's collections.
//
// The request handlers assume these indexes already exist rather than
// creating them per-request. Run this once after provisioning a database,
// and any time you add a new index below:
//
//   node scripts/ensure-indexes.mjs
//
// createIndex is idempotent, so re-running is always safe.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("dailicle");

  // One vote per visitor per essay; also backs the reaction upsert dedup.
  await db
    .collection("essay_reactions")
    .createIndex({ essayId: 1, ipHash: 1 }, { unique: true });
  console.log("✓ essay_reactions { essayId, ipHash } unique");

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
