# Business-day rollover design

## Goal

Wenxin Operations must switch from one business day to the next immediately at
00:00 in Kota Kinabalu (`Asia/Kuching`). The installed PWA must never continue
showing or querying the previous day's dashboard after the date changes.

Normal operational data does not need second-by-second updates. Its existing
manual, realtime, and periodic refresh paths may continue to operate at their
current cadence. Date rollover is a separate high-priority event.

## Root cause

The home server component currently derives dates with the runtime's local
`Date` getters. On Vercel that runtime may use UTC, which is still the previous
calendar day between 00:00 and 07:59 in Kota Kinabalu.

The home page also remains mounted as the root of the custom navigation stack.
When iOS restores the PWA from memory, no new server render is guaranteed, so
the date and all date-filtered dashboard data can remain on yesterday.

## Design

### One business-date authority

Add shared date helpers that explicitly calculate the current date in
`Asia/Kuching`, independent of server, browser, or device timezone. Server-side
dashboard queries and date labels must use this same business date.

The displayed label will be formatted from the business-date value rather than
from the server's local `new Date()` fields.

### Immediate midnight rollover

The home client wrapper will schedule a one-shot timer for the next
`Asia/Kuching` midnight. When it fires, it will request fresh home data and call
`router.refresh()`, causing all server-side “today” queries and dashboard cards
to move to the new business day.

After each refresh, it will schedule the following midnight. The timer will
include a small safety margin after 00:00 to avoid firing before the boundary
because of timer precision.

### Sleep and background recovery

Mobile operating systems pause JavaScript timers while an installed PWA is
backgrounded or the phone is asleep. Therefore, the wrapper will remember the
business date from its latest render and listen for:

- `visibilitychange` when the document becomes visible;
- `pageshow` when iOS restores a frozen page;
- window `focus` as an additional recovery path.

On each event it will calculate the current `Asia/Kuching` date. If the date is
different from the rendered business date, it will immediately refresh. It
will deduplicate concurrent rollover refreshes.

Ordinary foregrounding during the same business day will not trigger a full
dashboard refresh.

## Data flow

1. Server calculates one `businessDate` in `Asia/Kuching`.
2. Every home “today” query receives or uses that date.
3. Server renders the label and passes `businessDate` to the home client wrapper.
4. Client schedules the next midnight and watches lifecycle recovery events.
5. A detected date change invalidates home data and refreshes the server
   component.

## Failure handling

If the midnight refresh fails because the device is offline, the rendered date
remains marked as stale internally. A later visibility, pageshow, or focus event
will retry because the rendered business date still differs from the current
date. Existing pull-to-refresh remains available.

## Tests and acceptance criteria

- At `2026-06-20 23:59:59 Asia/Kuching`, the business date is `2026-06-20`.
- At `2026-06-21 00:00:00 Asia/Kuching`, it is `2026-06-21`, regardless of the
  host runtime timezone.
- A foreground PWA refreshes immediately when its midnight timer fires.
- A PWA suspended before midnight refreshes immediately on its first visible,
  pageshow, or focus event after midnight.
- Reopening or focusing the PWA during the same business day does not cause an
  unnecessary full refresh.
- Home date labels and all home date-filtered queries use the same business
  date.
- Type checking and relevant regression tests pass.

