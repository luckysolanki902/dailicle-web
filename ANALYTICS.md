# Analytics — events, funnels, setup

GA4 (`G-X79NX0FTRG`) + Microsoft Clarity are both live in `src/app/layout.tsx`.
All client tracking goes through `src/lib/analytics.ts`; verified server-side
payments go through `src/lib/ga-server.ts` (Measurement Protocol).

## Event catalog

Every reading event carries: `essay_id`, `essay_title`, `category` (slug:
psychology | relationships | philosophy | society | money), `category_label`,
`issue`, `reading_minutes`, `is_archived`.

| Event | When | Key params |
| --- | --- | --- |
| `page_view` | every route (incl. client nav) | `page_path` |
| `essay_view` | reader opens a released essay | reading base |
| `read_progress` | scroll 25/50/75/100% | `percent` |
| `read_complete` | 100% scroll **or** 60% of est. time read | `active_seconds` |
| `engaged_time` | once, on leave/hide | `active_seconds`, `max_scroll`, `completed` |
| `audio_play` / `audio_complete` | narration start / finish | essay base |
| `reaction` | like/dislike | `reaction` (up/down) |
| `share_click` | any share channel | `channel` |
| `subscribe` | footer email signup | `result` (new/already) |
| `feedback_submit` | feedback form sent | `has_identity` |
| `support_dialog_open` | dialog opens | `source`, `trigger_type` (auto/click), `page_path`, `essay_id`, `category`, `time_on_page_sec`, `essays_read_session`, `visit_count`, `has_supported_before` |
| `support_tier_select` | tier/custom chosen | `tier`, `amount` |
| `support_checkout_start` | "Support The Dailicle" clicked | `tier`/`amount`, `source` |
| `support_checkout_opened` | Razorpay modal shown | `tier`/`amount` |
| `support_checkout_dismissed` | Razorpay modal closed | `tier`/`amount` |
| `support_payment_success` | client success handler | `order_id`, `amount`, `currency` |
| `support_payment_verified` | **server**, HMAC-verified (authoritative conversion) | `value`, `currency`, `source`, `tier`, `method`, `country`, `category`, `essay_id` |

`support_payment_verified` is fired from `/api/support/verify` and, as a backup
for closed tabs, from `/api/support/webhook` — guarded by an atomic `gaReported`
flag so it counts **exactly once** per order. It's stitched to the browser
session via the GA `client_id` captured at checkout (stored on the order).

## Env vars (Vercel → Project → Settings → Environment Variables)

```
GA_MEASUREMENT_ID = G-X79NX0FTRG
GA_API_SECRET     = <Measurement Protocol API secret>
```

GA4 → Admin → Data Streams → (web stream) → *Measurement Protocol API secrets* →
Create. Until both are set, server-side events are a no-op (everything else works).

## One-time GA4 config (custom dimensions + conversions)

Registers the params above so they show up in reports, and marks the payment /
engagement events as key events:

```
npm i -D @google-analytics/admin
GA_PROPERTY_ID=<9-digit id> \
GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json \
node scripts/setup-ga4.mjs
```

Service account needs **Editor** on the property (GA4 → Admin → Property Access
Management). Idempotent — safe to re-run.

## Funnels to build (GA4 → Explore → Funnel exploration)

There is no API to create Explorations, so build these once in the UI:

1. **Payment funnel** — steps:
   `support_dialog_open` → `support_tier_select` → `support_checkout_start`
   → `support_checkout_opened` → `support_payment_verified`.
   Breakdown by `source` (navbar / footer / reader=auto / dialog) and
   `trigger_type`. Add `category` / `time_on_page_sec` / `visit_count` as
   breakdowns to see "who converts, from where, after how long."

2. **Reading funnel** — steps:
   `essay_view` → `read_progress` (75) → `read_complete`. Breakdown by
   `category` to see which of the 5 strands gets read deepest.

3. **Reading depth / time** — Free-form exploration: rows `category` +
   `essay_title`, metric = average of `active_seconds` (custom metric) and
   count of `read_complete` → time-read per essay and per category.

## Clarity

The same event names are marked on the Clarity session, and `category`,
`last_essay`, `read_complete` are set as filterable session tags. Use Clarity
for the qualitative side — watch recordings of sessions that opened the dialog
but didn't pay, filtered by category.
