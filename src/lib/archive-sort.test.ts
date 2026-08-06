import assert from "node:assert/strict";
import test from "node:test";
import { isSortMode, sortEntries, type SortableEntry } from "./archive-sort";

/** Mirrors the real archive: issues 6 and 7 are too new to have any likes. */
const entries: SortableEntry[] = [
  { href: "/read/i7", likes: 0, publishOn: "2026-08-03T00:00:00.000Z" },
  { href: "/read/i6", likes: 0, publishOn: "2026-07-27T00:00:00.000Z" },
  { href: "/read/i5", likes: 2, publishOn: "2026-07-20T00:00:00.000Z" },
  { href: "/read/i4", likes: 26, publishOn: "2026-07-13T00:00:00.000Z" },
  { href: "/read/i3", likes: 3, publishOn: "2026-07-06T00:00:00.000Z" },
  { href: "/read/i2", likes: 1, publishOn: "2026-06-29T00:00:00.000Z" },
  { href: "/read/i1", likes: 147, publishOn: "2026-06-22T00:00:00.000Z" },
];

const order = (list: SortableEntry[]) => list.map((e) => e.href);

test("popularity orders by likes, newest first among ties", () => {
  assert.deepEqual(order(sortEntries(entries, "popular")), [
    "/read/i1", // 147
    "/read/i4", // 26
    "/read/i3", // 3
    "/read/i5", // 2
    "/read/i2", // 1
    // Both on zero, so the newest of them comes first — a brand-new essay is
    // never buried under an older one that also has no likes.
    "/read/i7",
    "/read/i6",
  ]);
});

test("newest orders purely by date", () => {
  assert.deepEqual(order(sortEntries(entries, "new")), [
    "/read/i7",
    "/read/i6",
    "/read/i5",
    "/read/i4",
    "/read/i3",
    "/read/i2",
    "/read/i1",
  ]);
});

test("sorting does not mutate the caller's array", () => {
  const before = order(entries);
  sortEntries(entries, "popular");
  assert.deepEqual(order(entries), before);
});

test("entries missing likes or dates still sort deterministically", () => {
  const messy: SortableEntry[] = [
    { href: "/read/b" },
    { href: "/read/a", publishedAt: "2026-01-01T00:00:00.000Z" },
    { href: "/read/c" },
  ];
  // Dateless entries fall to the bottom, then tiebreak on href — and the same
  // input must give the same output every time, on the server and the client.
  const once = order(sortEntries(messy, "popular"));
  assert.deepEqual(once, ["/read/a", "/read/b", "/read/c"]);
  assert.deepEqual(order(sortEntries(messy, "popular")), once);
});

test("publishedAt is used when publishOn is absent", () => {
  const mixed: SortableEntry[] = [
    { href: "/read/old", publishedAt: "2025-01-01T00:00:00.000Z" },
    { href: "/read/new", publishOn: "2026-01-01T00:00:00.000Z" },
  ];
  assert.deepEqual(order(sortEntries(mixed, "new")), ["/read/new", "/read/old"]);
});

test("only the two real modes are accepted from the URL", () => {
  assert.equal(isSortMode("popular"), true);
  assert.equal(isSortMode("new"), true);
  assert.equal(isSortMode("likes"), false);
  assert.equal(isSortMode(null), false);
  assert.equal(isSortMode(undefined), false);
});
