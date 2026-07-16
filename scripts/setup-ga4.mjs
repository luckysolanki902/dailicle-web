// One-time (idempotent) GA4 setup via the Admin API. Registers the event
// parameters this app sends as custom dimensions/metrics — without this they
// exist in the raw data but can't be used in reports — and marks the payment /
// engagement events as key events (conversions).
//
// Prereqs:
//   npm i -D @google-analytics/admin
//   A service account with the "Editor" role on the GA4 property.
//
// Usage:
//   GA_PROPERTY_ID=123456789 \
//   GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json \
//   node scripts/setup-ga4.mjs
//
// Re-running is safe: anything that already exists is skipped.

import { AnalyticsAdminServiceClient } from "@google-analytics/admin";

const propertyId = process.env.GA_PROPERTY_ID;
if (!propertyId) {
  console.error("Set GA_PROPERTY_ID (the 9-digit numeric property id).");
  process.exit(1);
}
const parent = `properties/${propertyId}`;
const client = new AnalyticsAdminServiceClient();

// Event-scoped text params -> custom dimensions.
const DIMENSIONS = [
  ["category", "Essay category slug"],
  ["category_label", "Essay category label"],
  ["essay_id", "Essay id"],
  ["essay_title", "Essay title"],
  ["source", "Support source (navbar/footer/reader/dialog)"],
  ["trigger_type", "Dialog trigger (auto/click)"],
  ["tier", "Support tier"],
  ["channel", "Share channel"],
  ["reaction", "Essay reaction (up/down)"],
  ["result", "Subscribe result (new/already)"],
  ["percent", "Scroll milestone"],
  ["method", "Payment method"],
  ["country", "Reader country"],
  ["page_path", "Page path"],
  ["visit_count", "Visit count at event"],
  ["essays_read_session", "Essays read this session"],
  ["time_on_page_sec", "Seconds on page at event"],
  ["has_supported_before", "Had supported before"],
  ["completed", "Reached read completion"],
];

// Numeric params -> custom metrics.
const METRICS = [
  ["active_seconds", "Active reading seconds", "SECONDS"],
  ["max_scroll", "Max scroll percent", "STANDARD"],
];

// Events to mark as conversions (key events).
const KEY_EVENTS = [
  "support_payment_verified",
  "support_payment_success",
  "support_checkout_start",
  "subscribe",
  "read_complete",
];

const swallowExists = (label) => (err) => {
  if (String(err?.message || "").includes("already exists") || err?.code === 6) {
    console.log(`  = ${label} (exists)`);
    return null;
  }
  throw err;
};

async function run() {
  console.log(`GA4 setup for ${parent}\nCustom dimensions:`);
  for (const [parameterName, displayName] of DIMENSIONS) {
    await client
      .createCustomDimension({
        parent,
        customDimension: { parameterName, displayName, scope: "EVENT" },
      })
      .then(() => console.log(`  + ${parameterName}`))
      .catch(swallowExists(parameterName));
  }

  console.log("Custom metrics:");
  for (const [parameterName, displayName, unit] of METRICS) {
    await client
      .createCustomMetric({
        parent,
        customMetric: {
          parameterName,
          displayName,
          scope: "EVENT",
          measurementUnit: unit,
        },
      })
      .then(() => console.log(`  + ${parameterName}`))
      .catch(swallowExists(parameterName));
  }

  console.log("Key events (conversions):");
  for (const eventName of KEY_EVENTS) {
    await client
      .createKeyEvent({ parent, keyEvent: { eventName } })
      .then(() => console.log(`  + ${eventName}`))
      .catch(swallowExists(eventName));
  }

  console.log("\nDone. Dimensions/metrics take up to 24h to populate reports.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
