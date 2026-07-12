import assert from "node:assert/strict";
import test from "node:test";
import { isReleasedLocally, localReleaseDate } from "./release";

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
