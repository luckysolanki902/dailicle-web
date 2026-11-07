import assert from "node:assert/strict";
import test from "node:test";
import { isReleasedEverywhere, isReleasedLocally, localReleaseDate } from "./release";

test("a weekend-generated essay waits for local Monday midnight", () => {
  const generatedOnSaturday = {
    // Constructed in local time on purpose: release gating must not depend on
    // UTC dates or the timezone of the machine that ran the cron job.
    publish_on: new Date(2026, 6, 11, 12),
  };

  assert.equal(
    localReleaseDate(generatedOnSaturday)?.getTime(),
    new Date(2026, 6, 13).getTime()
  );
  assert.equal(
    isReleasedLocally(generatedOnSaturday, new Date(2026, 6, 12, 23, 59, 59)),
    false
  );
  assert.equal(
    isReleasedLocally(generatedOnSaturday, new Date(2026, 6, 13)),
    true
  );
});

test("a Monday essay is available exactly at that local midnight", () => {
  const generatedOnMonday = { publish_on: new Date(2026, 6, 13, 9) };

  assert.equal(
    localReleaseDate(generatedOnMonday)?.getTime(),
    new Date(2026, 6, 13).getTime()
  );
  assert.equal(
    isReleasedLocally(generatedOnMonday, new Date(2026, 6, 13)),
    true
  );
});

test("a standalone essay releases at the same instant for all readers", () => {
  const publishAt = "2026-11-07T06:00:00.000Z";
  const essay = { publish_on: publishAt, release_immediately: true };
  const before = new Date("2026-11-07T05:59:59.999Z");
  const at = new Date(publishAt);

  assert.equal(localReleaseDate(essay)?.toISOString(), publishAt);
  assert.equal(isReleasedLocally(essay, before), false);
  assert.equal(isReleasedEverywhere(essay, before), false);
  assert.equal(isReleasedLocally(essay, at), true);
  assert.equal(isReleasedEverywhere(essay, at), true);
});
