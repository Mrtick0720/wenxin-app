# Business-day Rollover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Home dashboard “today” value use Kota Kinabalu time and refresh the entire dashboard immediately when the business date crosses midnight.

**Architecture:** A focused `lib/businessDate.ts` module will own `Asia/Kuching` date calculation, display formatting, and next-midnight timing. The server Home component will calculate one business date per render and pass it to all date-filtered queries and the client `HomeRefresh` wrapper. `HomeRefresh` will schedule the midnight boundary and detect missed boundaries on PWA visibility, pageshow, and focus events.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Node assertion scripts.

---

## File map

- Create `lib/businessDate.ts`: pure Kota Kinabalu business-date and rollover timing helpers.
- Create `scripts/test-business-day-rollover.mjs`: executable regression tests for timezone boundaries and source-level lifecycle wiring.
- Modify `package.json`: add the focused rollover test script.
- Modify `app/page.tsx`: calculate one business date, use it for all Home queries, and format the date label from it.
- Modify `app/components/HomeRefresh.tsx`: schedule immediate midnight refresh and recover after PWA suspension.

### Task 1: Business-date authority

**Files:**
- Create: `scripts/test-business-day-rollover.mjs`
- Create: `lib/businessDate.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing timezone tests**

Create a test that imports `businessDateAt`, `formatBusinessDateLabel`, and
`millisecondsUntilNextBusinessDay`, then asserts:

```js
assert.equal(
  businessDateAt(new Date('2026-06-20T15:59:59.999Z')),
  '2026-06-20',
)
assert.equal(
  businessDateAt(new Date('2026-06-20T16:00:00.000Z')),
  '2026-06-21',
)
assert.equal(formatBusinessDateLabel('2026-06-21'), 'Jun 21 Sun')
assert.equal(
  millisecondsUntilNextBusinessDay(new Date('2026-06-20T15:59:59.000Z')),
  1_250,
)
```

The timing expectation includes the planned 250 ms post-midnight safety margin.

- [ ] **Step 2: Add and run the test command to verify RED**

Add:

```json
"test:business-day-rollover": "node --no-warnings --experimental-strip-types scripts/test-business-day-rollover.mjs"
```

Run:

```bash
npm run test:business-day-rollover
```

Expected: FAIL because `lib/businessDate.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Create `lib/businessDate.ts` with:

```ts
export const BUSINESS_TIME_ZONE = 'Asia/Kuching'
export const ROLLOVER_SAFETY_MS = 250

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function businessDateAt(now: Date = new Date()): string {
  return businessDateFormatter.format(now)
}

export function formatBusinessDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function millisecondsUntilNextBusinessDay(now: Date = new Date()): number {
  const current = businessDateAt(now)
  const [year, month, day] = current.split('-').map(Number)
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000
  return Math.max(0, nextMidnightUtc - now.getTime() + ROLLOVER_SAFETY_MS)
}
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run:

```bash
npm run test:business-day-rollover
```

Expected: all timezone and label assertions pass.

### Task 2: One server business date for Home

**Files:**
- Modify: `app/page.tsx`
- Modify: `scripts/test-business-day-rollover.mjs`

- [ ] **Step 1: Add failing Home source assertions**

Read `app/page.tsx` in the test and assert that:

```js
assert.match(homeSource, /const businessDate = businessDateAt\(\)/)
assert.match(homeSource, /<HomeRefresh businessDate=\{businessDate\}>/)
assert.doesNotMatch(homeSource, /const now = new Date\(\)/)
assert.doesNotMatch(homeSource, /todayLocalStr\(\)/)
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
npm run test:business-day-rollover
```

Expected: FAIL because Home still calculates dates independently.

- [ ] **Step 3: Thread one business date through Home queries**

Change date-filtered helpers to accept `businessDate: string`, for example:

```ts
async function getStats(
  supabase: SupabaseClient,
  enabled: boolean,
  businessDate: string,
) {
  if (!enabled) return null
  return supabase.from('daily_stats').select('*').eq('date', businessDate).single()
}
```

At the beginning of `Home`, calculate:

```ts
const businessDate = businessDateAt()
```

Pass that value to stats, Bento, incident, task, reservation, and other Home
queries currently based on `todayLocalStr()`. Use the same value as `bizToday`
for revenue comparisons and render:

```ts
const todayStr = formatBusinessDateLabel(businessDate)
```

Pass it to the client wrapper:

```tsx
<HomeRefresh businessDate={businessDate}>
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run:

```bash
npm run test:business-day-rollover
```

Expected: Home source assertions and pure date tests pass.

### Task 3: Immediate foreground and recovery rollover

**Files:**
- Modify: `app/components/HomeRefresh.tsx`
- Modify: `scripts/test-business-day-rollover.mjs`

- [ ] **Step 1: Add failing lifecycle assertions**

Read `HomeRefresh.tsx` and assert the source includes:

```js
assert.match(refreshSource, /millisecondsUntilNextBusinessDay/)
assert.match(refreshSource, /visibilitychange/)
assert.match(refreshSource, /pageshow/)
assert.match(refreshSource, /window\.addEventListener\('focus'/)
assert.match(refreshSource, /businessDateAt\(\) !== businessDate/)
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
npm run test:business-day-rollover
```

Expected: FAIL because lifecycle rollover handling is absent.

- [ ] **Step 3: Implement one deduplicated rollover refresh**

Update the wrapper props and add a stable refresh function:

```ts
export default function HomeRefresh({
  children,
  businessDate,
}: {
  children: React.ReactNode
  businessDate: string
}) {
```

Use a ref to prevent concurrent calls. The rollover refresh must:

```ts
await refreshHomeData()
router.refresh()
```

Install one timeout using `millisecondsUntilNextBusinessDay()`. Install
`visibilitychange`, `pageshow`, and `focus` listeners. Each recovery listener
calls the rollover refresh only when:

```ts
businessDateAt() !== businessDate
```

Clear the timeout and all listeners on effect cleanup. Manual pull-to-refresh
continues to use the existing refresh path.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run:

```bash
npm run test:business-day-rollover
```

Expected: all rollover tests pass.

### Task 4: Verification

**Files:**
- Verify all files changed above.

- [ ] **Step 1: Run focused regression tests**

```bash
npm run test:business-day-rollover
npm run test:feedme-dates
npm run test:root-hydration
```

Expected: all pass with zero failures.

- [ ] **Step 2: Run TypeScript checking**

```bash
npx tsc --noEmit
```

Expected: exit code 0 and no TypeScript errors.

- [ ] **Step 3: Inspect the final scoped diff**

```bash
git diff -- \
  lib/businessDate.ts \
  scripts/test-business-day-rollover.mjs \
  package.json \
  app/page.tsx \
  app/components/HomeRefresh.tsx
```

Confirm the diff does not include unrelated Bento or proxy work.

