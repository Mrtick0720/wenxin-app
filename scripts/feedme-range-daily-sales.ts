/**
 * FeedMe Daily Sales over a DATE RANGE (LOCAL ONLY, not production).
 *
 * Parameterizes the captured single-day query's `timeDimension` to cover a range
 * (last 7 business days, then month-to-date), calls postgres-query with a
 * refresh-minted idToken, and parses every daily row via parseFeedMeDailyRows.
 * Never prints the token; never dumps the raw response.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getFeedMeIdToken, hasRefreshToken } from '../lib/feedme/refreshIdToken'
import { parseFeedMeDailyRows, businessToday } from '../lib/feedme/parseQueryResult'

const ENDPOINT_BASE = 'https://query-engine.feedmeapi.com/report-query'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}
function money(n: number): string {
  return `RM ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// MYT (UTC+8) business-day boundaries expressed as UTC instants.
function dayStartUtc(date: string): string {
  return new Date(`${date}T00:00:00.000+08:00`).toISOString()
}
function dayEndUtc(date: string): string {
  return new Date(`${date}T23:59:59.999+08:00`).toISOString()
}

function buildPayload(base: unknown, startDate: string, endDate: string): string {
  const specs = JSON.parse(JSON.stringify(base)) as Array<Record<string, unknown>>
  const td = {
    start: dayStartUtc(startDate),
    end: dayEndUtc(endDate),
    timeStart: dayStartUtc(startDate),
    timeEnd: dayEndUtc(endDate),
  }
  for (const spec of specs) spec.timeDimension = td
  return JSON.stringify(specs)
}

async function runRange(
  label: string,
  startDate: string,
  endDate: string,
  idToken: string,
  businessId: string,
  base: unknown,
): Promise<void> {
  console.log(`\n=== ${label}: ${startDate} → ${endDate} ===`)
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: buildPayload(base, startDate, endDate),
    cache: 'no-store',
  })
  console.log(`  HTTP status: ${res.status} ${res.statusText}`)
  if (!res.ok) fail(`postgres-query failed (HTTP ${res.status})`)

  const points = parseFeedMeDailyRows(await res.json())
  console.log(`  rows parsed: ${points.length}`)
  let total = 0
  for (const p of points) {
    total += p.revenue
    console.log(`    ${p.date}  ${money(p.revenue)}  (qty ${p.qty}, pax ${p.pax ?? '-'})`)
  }
  const avg = points.length ? total / points.length : 0
  console.log(`  dates: ${points.map((p) => p.date).join(', ') || '(none)'}`)
  console.log(`  total revenue : ${money(total)}`)
  console.log(`  average / day : ${money(avg)} over ${points.length} day(s)`)
}

async function main(): Promise<void> {
  if (!hasRefreshToken()) fail('FEEDME_REFRESH_TOKEN not set in .env.local')
  const idToken = await getFeedMeIdToken()
  if (!idToken) fail('Could not mint idToken from refresh token')
  console.log(`idToken minted (length ${idToken.length}, hidden)`)

  const businessId = process.env.FEEDME_BUSINESS_ID
  if (!businessId) fail('Missing FEEDME_BUSINESS_ID')
  const file = resolve(process.env.FEEDME_QUERY_FILE ?? 'scripts/feedme-daily-sales.query.json')
  if (!existsSync(file)) fail(`Missing query payload: ${file}`)
  const base = JSON.parse(readFileSync(file, 'utf8'))

  const today = businessToday()
  const lastCompleted = addDays(today, -1)

  // Last 7 business days, ending on the latest completed day.
  await runRange('Last 7 days', addDays(lastCompleted, -6), lastCompleted, idToken, businessId, base)

  // Month-to-date: 1st of the current month → today.
  await runRange('Month-to-date', `${today.slice(0, 7)}-01`, today, idToken, businessId, base)
}

main().catch((error) => fail((error as Error).message))
