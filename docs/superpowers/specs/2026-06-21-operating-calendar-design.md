# Operating calendar and live store status design

## Goal

Replace the hard-coded Home `Open` pill with the real customer-facing operating
status of 文心砂锅, and add an independent operating calendar for planned changes.

The status represents whether ordinary walk-in customers are currently being
served. It is not derived from staff attendance, kitchen activity, Bento
production, or cashier shift state.

## Confirmed default schedule

The restaurant operates seven days per week:

- `00:00–10:00`: `Closed`
- `10:00–15:00`: `Open`
- `15:00–17:00`: `Break`
- `17:00–22:00`: `Open`
- `22:00–24:00`: `Closed`

All calculations use `Asia/Kuching`.

The Home pill displays only one of:

- `Open`
- `Break`
- `Closed`

It does not show opening times, countdowns, or explanatory text.

## Information architecture

### Home status pill

The pill shows the current effective status.

Users with edit permission can tap it to make a temporary change for today.
Read-only users can tap it only to inspect today's schedule and the source of
the current status.

### Independent Operating Calendar

Operating Calendar is a standalone management page, separate from Staff
Schedule and Bento.

The month calendar supports future dates and today. Selecting a date allows an
authorized user to choose:

- use the normal schedule;
- early opening at `08:00`, retaining the `15:00–17:00` break and `22:00`
  closing;
- closed all day;
- custom operating periods and optional break periods.

Date-specific schedules apply only to their selected calendar date. The next
date automatically returns to its own date-specific schedule or the weekly
default.

### Staff Schedule integration

Staff Schedule remains responsible for who works, not whether the restaurant
is open. It will display the operating periods for the selected date and may
warn when an open period has inadequate staff coverage.

Editing a staff shift never changes the restaurant's operating schedule.

### Role and Permissions

Add an Operating Calendar capability to the existing Role and Permissions
area. The Owner can assign each role one of:

- `Edit`: view schedules, modify dates, and apply temporary status overrides;
- `View`: view schedules and current status without changing them;
- `No access`: cannot open the Operating Calendar; the Home status remains
  visible as general operational information.

Initial values:

- Owner: `Edit`, fixed and not removable;
- Manager: `Edit`;
- all other roles: `View`.

Only the Owner can change role permission levels. Managers cannot change their
own permission or another role's permission. Permission checks are enforced in
server actions and database policies, not only by hiding UI controls.

## Schedule model

### Weekly defaults

The default schedule stores one row per weekday. Initially all seven rows have
the same periods:

```text
10:00–15:00 open
15:00–17:00 break
17:00–22:00 open
```

The model supports future changes to individual weekdays without changing the
current seven-day default.

### Date exceptions

A date exception contains:

- business date;
- exception type: early opening, closed all day, or custom;
- ordered time periods;
- optional note;
- creator and creation time;
- last editor and edit time.

Removing an exception restores the weekly default for that date.

### Temporary status overrides

From Home, an editor may temporarily choose `Open`, `Break`, or `Closed`.
Entering a reason is optional.

An override records:

- selected status;
- effective time;
- automatic expiry time;
- optional reason;
- creator and creation time.

The expiry is the next boundary in the effective schedule for that date. For
the default schedule, those boundaries are `10:00`, `15:00`, `17:00`, `22:00`,
and midnight. At expiry, the schedule automatically becomes authoritative
again. Editing the date's schedule recalculates or clears any incompatible
temporary override.

Examples:

- At `16:00`, selecting `Open` lasts until `17:00`.
- At `14:00`, selecting `Closed` lasts until `15:00`.
- At `23:00`, selecting `Open` lasts until midnight.

An editor can replace an active override before it expires.

## Effective status calculation

The status resolver uses this order:

1. active, unexpired temporary override;
2. date-specific schedule exception;
3. weekday default schedule.

Given the effective schedule and current `Asia/Kuching` time:

- an open period produces `Open`;
- an explicit break period produces `Break`;
- all other times produce `Closed`.

The server provides the initial result. A small client status component
schedules its next update at the next schedule boundary or override expiry, so
the pill changes immediately without second-by-second polling. On
`visibilitychange`, `pageshow`, and focus, it recomputes to recover from mobile
sleep.

The separate business-day rollover refresh remains responsible for changing
all date-filtered dashboard data at midnight.

## Auditing and concurrency

Every schedule, exception, override, and permission change records the acting
staff user and timestamp. Optional notes and reasons are retained.

Writes use the latest stored revision/update time so simultaneous edits do not
silently overwrite newer changes. On conflict, the user is asked to reload the
latest schedule.

## Failure handling

- If schedule data cannot be loaded, Home displays `Closed` in a neutral/error
  treatment rather than falsely claiming the restaurant is open.
- Editing controls show a retryable error and preserve unsaved form values.
- Expired overrides are ignored by the resolver even if database cleanup has
  not yet run.
- Permission changes take effect on the next server action immediately and on
  visible UI after refresh.

## Acceptance criteria

- The Home status is never hard-coded.
- The default status transitions immediately at `10:00`, `15:00`, `17:00`,
  and `22:00` in `Asia/Kuching`.
- An early-opening date is `Open` from `08:00`.
- The default `15:00–17:00` period displays `Break`.
- An all-day closure displays `Closed` for the full date.
- A Home temporary override expires at the next effective schedule boundary.
- Owner and Manager initially have edit access.
- The Owner can change Manager to View or No access without a code deployment.
- Read-only and unauthorized users cannot mutate schedules through direct
  server requests.
- Every mutation records actor, timestamp, and optional reason/note.
- Staff Schedule can display operating periods without owning or changing them.

