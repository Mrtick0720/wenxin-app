# Operating Calendar and Live Store Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded Home status with a live `Open / Break / Closed` result and provide a permission-controlled operating calendar for defaults, future exceptions, and temporary same-day overrides.

**Architecture:** A pure operating-status domain module resolves schedules and next transition times in `Asia/Kuching`. Supabase stores weekly defaults, date exceptions, temporary overrides, and role capability levels with audit metadata and RLS. Server actions enforce permissions; a small Home client component updates exactly at status boundaries and after PWA resume; the independent calendar edits future dates while Staff Schedule only reads and displays operating periods.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase/Postgres RLS, Node assertion scripts.

**Dependency:** Complete `docs/superpowers/plans/2026-06-21-business-day-rollover.md` first. This plan imports its shared `lib/businessDate.ts` helpers.

---

## File map

- Create `lib/operatingCalendar/types.ts`: domain types.
- Create `lib/operatingCalendar/status.ts`: pure status resolver and boundary logic.
- Create `lib/operatingCalendar/repository.ts`: server-side Supabase reads.
- Create `lib/operatingCalendar/permissions.ts`: capability-level parsing and checks.
- Create `app/operating-calendar/actions.ts`: guarded mutations.
- Create `app/operating-calendar/page.tsx`: direct-URL auth shell.
- Create `app/operating-calendar/OperatingCalendarClient.tsx`: independent calendar UI.
- Create `app/components/OperatingStatusPill.tsx`: live Home status and override sheet.
- Create `app/staff/accounts/RolePermissionsPage.tsx`: Owner-only role capability editor.
- Create `supabase/migrations/20260621_operating_calendar.sql`: schema, seed data, RLS, audit triggers.
- Create `scripts/test-operating-calendar.mjs`: domain and wiring regression tests.
- Modify `app/page.tsx`: load effective schedule/status and replace placeholder.
- Modify `app/staff/page.tsx`: show selected date operating periods.
- Modify `app/staff/accounts/StaffAccountsClient.tsx`: entry to role permissions.
- Modify `app/lib/stackRoutes.tsx` and `app/lib/stackPages.tsx`: register the client-safe calendar page.
- Modify `lib/auth/permissions.ts`: route access for the calendar.
- Modify `package.json`: focused test command.

### Task 1: Pure operating-status domain

**Files:**
- Create: `lib/operatingCalendar/types.ts`
- Create: `lib/operatingCalendar/status.ts`
- Create: `scripts/test-operating-calendar.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing status tests**

Define tests for the default periods:

```ts
const defaultPeriods = [
  { kind: 'open', start: '10:00', end: '15:00' },
  { kind: 'break', start: '15:00', end: '17:00' },
  { kind: 'open', start: '17:00', end: '22:00' },
]
```

Assert `Closed` at `09:59`, `Open` at `10:00`, `Break` at `15:00`, `Open`
at `17:00`, and `Closed` at `22:00`. Assert an early-opening exception is
`Open` at `08:00`, and a temporary override wins only before its expiry.

- [ ] **Step 2: Add the test command and verify RED**

Add:

```json
"test:operating-calendar": "node --no-warnings --experimental-strip-types scripts/test-operating-calendar.mjs"
```

Run:

```bash
npm run test:operating-calendar
```

Expected: FAIL because the domain files do not exist.

- [ ] **Step 3: Implement domain types**

Use:

```ts
export type OperatingStatus = 'open' | 'break' | 'closed'
export type OperatingPeriodKind = 'open' | 'break'
export type OperatingPeriod = {
  kind: OperatingPeriodKind
  start: string
  end: string
}
export type OperatingSchedule = {
  date: string
  source: 'weekly_default' | 'date_exception'
  periods: OperatingPeriod[]
  closedAllDay: boolean
}
export type StatusOverride = {
  status: OperatingStatus
  startsAt: string
  expiresAt: string
}
export type EffectiveOperatingStatus = {
  status: OperatingStatus
  source: 'schedule' | 'override'
  nextTransitionAt: string
}
```

- [ ] **Step 4: Implement the minimal resolver**

`resolveOperatingStatus(schedule, now, override)` must:

1. return an active override when `startsAt <= now < expiresAt`;
2. return `closed` for `closedAllDay`;
3. match `HH:mm` against ordered periods;
4. return the next period boundary or next midnight as `nextTransitionAt`.

Validate periods with `start < end`, no overlap, and `HH:mm` format.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npm run test:operating-calendar
```

Expected: all pure status assertions pass.

### Task 2: Database schema, seed schedule, and RLS

**Files:**
- Create: `supabase/migrations/20260621_operating_calendar.sql`
- Modify: `scripts/test-operating-calendar.mjs`

- [ ] **Step 1: Add failing migration source assertions**

Assert the migration contains all four tables, RLS enablement, initial Manager
`edit` permission, and operational audit triggers.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:operating-calendar
```

Expected: FAIL because the migration is absent.

- [ ] **Step 3: Create the schema**

Create:

```sql
create table public.operating_weekly_schedules (
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  periods jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id),
  primary key (outlet_id, weekday)
);

create table public.operating_date_exceptions (
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  business_date date not null,
  exception_type text not null check (
    exception_type in ('early_opening', 'closed_all_day', 'custom')
  ),
  periods jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff_profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id),
  primary key (outlet_id, business_date)
);

create table public.operating_status_overrides (
  id bigint generated by default as identity primary key,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  business_date date not null,
  status text not null check (status in ('open', 'break', 'closed')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.staff_profiles(id),
  check (expires_at > starts_at)
);

create table public.role_capabilities (
  role text not null,
  capability text not null,
  access_level text not null check (access_level in ('edit', 'view', 'none')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id),
  primary key (role, capability)
);
```

Seed seven identical weekday schedules and:

```sql
('owner', 'operating_calendar', 'edit'),
('manager', 'operating_calendar', 'edit'),
('kitchen', 'operating_calendar', 'view'),
('front_desk', 'operating_calendar', 'view'),
('cashier', 'operating_calendar', 'view'),
('packing', 'operating_calendar', 'view'),
('delivery', 'operating_calendar', 'view'),
('other', 'operating_calendar', 'view')
```

Add RLS helper functions that read the current staff role and capability.
Owner always resolves to `edit`. Schedule and override writes require `edit`;
reads require `view` or `edit`. Only Owner can update `role_capabilities`.
Attach `write_operational_audit` triggers to every mutable table.

- [ ] **Step 4: Run migration source tests and verify GREEN**

Run:

```bash
npm run test:operating-calendar
```

Expected: migration assertions pass.

### Task 3: Repository and permission enforcement

**Files:**
- Create: `lib/operatingCalendar/permissions.ts`
- Create: `lib/operatingCalendar/repository.ts`
- Create: `app/operating-calendar/actions.ts`
- Modify: `scripts/test-operating-calendar.mjs`

- [ ] **Step 1: Add failing capability and action assertions**

Test `canViewOperatingCalendar('view')`, `canEditOperatingCalendar('edit')`,
Owner fallback behavior, and source assertions that every mutation calls an
edit guard before writing.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm failure for missing modules.

- [ ] **Step 3: Implement reads**

Implement:

```ts
getOperatingAccess(role: StaffRole): Promise<'edit' | 'view' | 'none'>
getWeeklySchedules(): Promise<WeeklySchedule[]>
getScheduleForDate(date: string): Promise<OperatingSchedule>
getActiveOverride(date: string, now?: Date): Promise<StatusOverride | null>
getOperatingSnapshot(date: string, now?: Date): Promise<{
  schedule: OperatingSchedule
  override: StatusOverride | null
  effective: EffectiveOperatingStatus
}>
```

Expired overrides must be ignored in the read query and resolver.

- [ ] **Step 4: Implement guarded server actions**

Implement actions for:

```ts
saveDateExceptionAction(input)
deleteDateExceptionAction(date)
saveWeeklyScheduleAction(input)
createStatusOverrideAction({ status, reason })
updateOperatingCapabilityAction({ role, accessLevel })
```

Each action must call `requireCurrentStaff()`, resolve access from the database,
and reject unauthorized direct calls. Capability changes require
`requireRole('owner')`; Owner capability cannot be reduced. Validate date,
periods, reason length, and optimistic `updatedAt` before writes. Revalidate
`/`, `/operating-calendar`, and `/staff`.

- [ ] **Step 5: Run focused tests and TypeScript checking**

Run:

```bash
npm run test:operating-calendar
npx tsc --noEmit
```

Expected: domain/action tests pass and no type errors.

### Task 4: Live Home status pill

**Files:**
- Create: `app/components/OperatingStatusPill.tsx`
- Modify: `app/page.tsx`
- Modify: `scripts/test-operating-calendar.mjs`

- [ ] **Step 1: Add failing Home wiring assertions**

Assert `app/page.tsx` no longer contains the placeholder comment or literal
hard-coded pill, and renders:

```tsx
<OperatingStatusPill
  snapshot={operatingSnapshot}
  access={operatingAccess}
/>
```

- [ ] **Step 2: Verify RED**

Run the focused test and confirm the old placeholder fails assertions.

- [ ] **Step 3: Implement the live component**

The component receives the server snapshot and access level. It:

- displays only `Open`, `Break`, or `Closed`;
- uses green, amber, or gray styling;
- schedules a timeout for `effective.nextTransitionAt`;
- calls `router.refresh()` at the boundary;
- rechecks on `visibilitychange`, `pageshow`, and `focus`;
- opens a same-day override sheet only for `edit` users;
- offers three statuses and an optional reason;
- submits through `createStatusOverrideAction`.

Read-only users may open a compact read-only schedule sheet. `none` users see
the status but no calendar navigation.

- [ ] **Step 4: Load status server-side**

In Home, load operating access and snapshot with the same `businessDate` used
by all dashboard queries. On read failure, pass a neutral `Closed` fallback.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run test:operating-calendar
npx tsc --noEmit
```

Expected: Home wiring tests pass and types remain clean.

### Task 5: Independent Operating Calendar UI

**Files:**
- Create: `app/operating-calendar/page.tsx`
- Create: `app/operating-calendar/OperatingCalendarClient.tsx`
- Modify: `app/lib/stackRoutes.tsx`
- Modify: `app/lib/stackPages.tsx`
- Modify: `app/components/home/QuickAccessGrid.tsx`
- Modify: `lib/auth/permissions.ts`

- [ ] **Step 1: Add failing route and UI source assertions**

Assert `/operating-calendar` exists in route metadata, stack pages, auth route
rules, and Quick Access.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm missing route failures.

- [ ] **Step 3: Implement the page**

The direct URL page authenticates, loads access and the visible month, and
renders `OperatingCalendarClient`. The client month view marks:

- normal schedule;
- `08:00` early opening;
- closed all day;
- custom schedule.

Selecting a day opens an editor with Normal, Early 08:00, Closed all day, and
Custom. The custom editor adds/removes ordered open and break periods. View
users see the same detail without mutation controls.

- [ ] **Step 4: Register stack navigation**

Add route metadata and a lazy-loaded client-safe stack page. Add a Quick Access
entry filtered by route access. Route access allows roles with initial
`view/edit`; server data and actions remain authoritative for dynamic
capability changes.

- [ ] **Step 5: Verify calendar behavior**

Run focused tests, TypeScript, and manually check:

- month navigation;
- future early-opening save;
- all-day closure save;
- restoring Normal deletes the exception;
- View mode hides save controls.

### Task 6: Owner-managed role capability UI

**Files:**
- Create: `app/staff/accounts/RolePermissionsPage.tsx`
- Modify: `app/staff/accounts/StaffAccountsClient.tsx`
- Modify: `scripts/test-operating-calendar.mjs`

- [ ] **Step 1: Add failing permissions UI assertions**

Assert the staff accounts UI includes a `Role & Permissions` entry and that
the page calls `updateOperatingCapabilityAction`.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm failure.

- [ ] **Step 3: Implement Owner-only editor**

Add a page listing roles with an Operating Calendar selector:

```text
Owner       Edit (locked)
Manager     Edit | View | No access
Kitchen     Edit | View | No access
Front Desk  Edit | View | No access
...
```

Only Owner sees the entry. Save one role at a time, display mutation errors,
and refresh current values after success.

- [ ] **Step 4: Verify capability changes**

Test Manager transitions from Edit → View → No access and confirm direct
mutation actions reject View/No access even if manually invoked.

### Task 7: Staff Schedule read-only integration

**Files:**
- Modify: `app/staff/page.tsx`
- Modify: `scripts/test-operating-calendar.mjs`

- [ ] **Step 1: Add failing source assertion**

Assert Staff Schedule loads `getScheduleForDate` through a server action or
read endpoint and renders an `Operating hours` summary.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm failure.

- [ ] **Step 3: Add schedule context**

For `selectedDate`, display compact periods such as:

```text
Operating hours: 10:00–15:00 · Break 15:00–17:00 · 17:00–22:00
```

For early opening, show `08:00–15:00`; for closure, show `Closed all day`.
Do not add editing controls and do not alter staff shift writes.

- [ ] **Step 4: Add basic coverage warning**

When an open period starts before every scheduled working shift, show a
non-blocking warning. This warning is informational and never changes either
schedule.

- [ ] **Step 5: Verify Staff behavior**

Confirm changing staff shifts does not mutate operating-calendar tables and
changing operating hours does not mutate `staff_shifts`.

### Task 8: Final verification

**Files:**
- Verify all files above.

- [ ] **Step 1: Run focused and related tests**

```bash
npm run test:business-day-rollover
npm run test:operating-calendar
npm run test:auth-permissions
npm run test:attendance
npm run test:root-hydration
```

Expected: zero failures.

- [ ] **Step 2: Run static verification**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors introduced by this feature.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: production build exits successfully.

- [ ] **Step 4: Inspect scoped diff**

Confirm no unrelated Bento, proxy, or user-owned changes are included in the
feature diff or commits.

