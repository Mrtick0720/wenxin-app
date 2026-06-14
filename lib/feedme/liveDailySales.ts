// Server-only refresh layer: today's revenue from the LIVE FeedMe
// postgres-query endpoint, with short TTL caching and a last-successful fallback.
//
// Source of truth = the live FeedMe parser result. To avoid hammering FeedMe,
// a successful fetch is memoized in-process for CACHE_TTL_MS; renders inside
// that window reuse it. If the live call is unavailable (no/expired token,
// network error, non-2xx), we serve the LAST SUCCESSFUL value (in-process memo,
// then on-disk cache) — never a fabricated/seeded value. If none exists, null.
//
// Secrets come from process.env (.env.local, auto-loaded by Next) and are never
// logged or returned. Uses node:fs — must only be imported server-side.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import {
  parseFeedMeQueryResult,
  parseFeedMeDailyRows,
  businessToday,
  type FeedMeLiveDailySales,
} from './parseQueryResult'
import type { DailySalesPoint } from './parseDailySales'
import { getFeedMeIdToken, hasRefreshToken } from './refreshIdToken'

const ENDPOINT_BASE = 'https://query-engine.feedmeapi.com/report-query'
const CACHE_FILE = resolve(process.cwd(), 'lib/feedme/.cache/last-daily-sales.json')
const FETCH_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 min refresh window (2–5 min acceptable)

export interface FeedMeDailyRevenue {
  value: FeedMeLiveDailySales
  source: 'live' | 'cache'
  fetchedAt: string
}

interface CacheEnvelope {
  fetchedAt: string
  value: FeedMeLiveDailySales
}

// In-process memo: repeated dashboard renders within the TTL reuse one fetch.
let memo: CacheEnvelope | null = null

function queryFilePath(): string {
  return process.env.FEEDME_QUERY_FILE
    ? resolve(process.env.FEEDME_QUERY_FILE)
    : resolve(process.cwd(), 'scripts/feedme-daily-sales.query.json')
}

function readCacheFile(): CacheEnvelope | null {
  try {
    if (!existsSync(CACHE_FILE)) return null
    const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Partial<CacheEnvelope>
    if (parsed && typeof parsed === 'object' && parsed.value && parsed.fetchedAt) {
      return parsed as CacheEnvelope
    }
    return null
  } catch {
    return null
  }
}

function writeCacheFile(envelope: CacheEnvelope): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(envelope, null, 2))
  } catch {
    // Read-only filesystem (e.g. serverless) — keep serving the in-memory value.
  }
}

// Bearer source: prefer a freshly-minted idToken from the refresh layer; fall
// back to a manually-pasted FEEDME_BEARER_TOKEN when no refresh token is set.
async function resolveBearer(): Promise<string | null> {
  if (hasRefreshToken()) {
    const minted = await getFeedMeIdToken()
    if (minted) return minted
  }
  return process.env.FEEDME_BEARER_TOKEN ?? null
}

async function fetchLive(): Promise<FeedMeLiveDailySales | null> {
  const token = await resolveBearer()
  const businessId = process.env.FEEDME_BUSINESS_ID
  if (!token) { console.warn('[feedme] fetchLive: no bearer token resolved'); return null }
  if (!businessId) { console.warn('[feedme] fetchLive: FEEDME_BUSINESS_ID not set'); return null }

  const file = queryFilePath()
  if (!existsSync(file)) { console.warn('[feedme] fetchLive: query file not found:', file); return null }
  let body: string
  try {
    body = readFileSync(file, 'utf8')
  } catch {
    console.warn('[feedme] fetchLive: failed to read query file')
    return null
  }
  if (body.includes('<<PASTE')) { console.warn('[feedme] fetchLive: query file still has <<PASTE placeholder'); return null }
  body = body.split('${FEEDME_BUSINESS_ID}').join(businessId)
  if (process.env.FEEDME_RESTAURANT_ID) {
    body = body.split('${FEEDME_RESTAURANT_ID}').join(process.env.FEEDME_RESTAURANT_ID)
  }

  // Override the query's timeDimension to target today's business date (MYT).
  body = singleDayPayload(body, businessToday())

  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn('[feedme] fetchLive: HTTP', res.status, res.statusText)
      return null
    }
    const raw = await res.json()
    const parsed = parseFeedMeQueryResult(raw)
    console.log('[feedme] fetchLive: OK | date=', parsed.date, 'revenue=', parsed.revenue, 'qty=', parsed.qty, 'pax=', parsed.pax)
    return parsed
  } catch (err) {
    console.warn('[feedme] fetchLive: fetch error', (err as Error).message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Live data (refreshing memo + disk cache) when available, else the last
// successful value, else null. Throttled to one upstream call per TTL window.
export async function getFeedMeDailyRevenue(): Promise<FeedMeDailyRevenue | null> {
  const now = Date.now()

  // 1. Serve a fresh-enough memoized value without calling FeedMe again.
  if (memo && now - Date.parse(memo.fetchedAt) < CACHE_TTL_MS) {
    return { value: memo.value, source: 'cache', fetchedAt: memo.fetchedAt }
  }

  // 2. TTL expired (or first call) — try live.
  const live = await fetchLive()
  if (live) {
    const envelope: CacheEnvelope = { fetchedAt: new Date(now).toISOString(), value: live }
    memo = envelope
    writeCacheFile(envelope)
    return { value: envelope.value, source: 'live', fetchedAt: envelope.fetchedAt }
  }

  // 3. Live unavailable — last successful value: memo (even if stale), then disk.
  if (memo) return { value: memo.value, source: 'cache', fetchedAt: memo.fetchedAt }
  const file = readCacheFile()
  if (file) {
    memo = file
    return { value: file.value, source: 'cache', fetchedAt: file.fetchedAt }
  }
  return null
}

// ── Safe runtime diagnostics (no secrets) ────────────────────────────────────
// Booleans + upstream HTTP status only, so a prod misconfig can be pinpointed via
// /api/feedme/daily-revenue?debug=1 without ever exposing tokens. TEMPORARY.
export async function feedmeDiagnostics() {
  const businessId = process.env.FEEDME_BUSINESS_ID
  const file = queryFilePath()
  const queryFileExists = existsSync(file)

  let bearerResolved = false
  try {
    bearerResolved = Boolean(await resolveBearer())
  } catch {
    bearerResolved = false
  }

  let upstreamStatus: number | string = 'not-attempted'
  if (bearerResolved && businessId && queryFileExists) {
    try {
      const token = await resolveBearer()
      let bodyText = readFileSync(file, 'utf8')
      bodyText = bodyText.split('${FEEDME_BUSINESS_ID}').join(businessId)
      if (process.env.FEEDME_RESTAURANT_ID) {
        bodyText = bodyText.split('${FEEDME_RESTAURANT_ID}').join(process.env.FEEDME_RESTAURANT_ID)
      }
      bodyText = singleDayPayload(bodyText, businessToday())
      const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: bodyText,
        cache: 'no-store',
      })
      upstreamStatus = res.status
    } catch (e) {
      upstreamStatus = `error:${(e as Error).name}`
    }
  }

  return {
    envBusinessIdSet: Boolean(process.env.FEEDME_BUSINESS_ID),
    envRestaurantIdSet: Boolean(process.env.FEEDME_RESTAURANT_ID),
    hasRefreshToken: hasRefreshToken(),
    queryFileExists,
    bearerResolved,
    upstreamStatus,
  }
}

// ── Month-to-date summary (Hero slide 2) ─────────────────────────────────────

const MTD_CACHE_FILE = resolve(process.cwd(), 'lib/feedme/.cache/last-mtd.json')

export interface FeedMeMtdSummary {
  monthStart: string
  asOf: string
  mtdRevenue: number
  mtdAverage: number // average over operating days (revenue > 0)
  bestDayRevenue: number
  operatingDays: number
}

let mtdMemo: { fetchedAt: string; value: FeedMeMtdSummary } | null = null

function dayStartUtc(date: string): string {
  return new Date(`${date}T00:00:00.000+08:00`).toISOString()
}
function dayEndUtc(date: string): string {
  return new Date(`${date}T23:59:59.999+08:00`).toISOString()
}
function round2(n: number): number {
  return Number(n.toFixed(2))
}

function readJson<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}
function writeJson(file: string, data: unknown): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data, null, 2))
  } catch {
    // Read-only filesystem — keep serving the in-memory value.
  }
}

// Override every query spec's timeDimension to a single day (MYT).
function singleDayPayload(baseText: string, date: string): string {
  const specs = JSON.parse(baseText) as Array<Record<string, unknown>>
  const td = {
    start: dayStartUtc(date),
    end: dayEndUtc(date),
    timeStart: dayStartUtc(date),
    timeEnd: dayEndUtc(date),
  }
  for (const spec of specs) spec.timeDimension = td
  return JSON.stringify(specs)
}

// Override every query spec's timeDimension to span [startDate, endDate] (MYT).
function rangePayload(baseText: string, startDate: string, endDate: string): string {
  const specs = JSON.parse(baseText) as Array<Record<string, unknown>>
  const td = {
    start: dayStartUtc(startDate),
    end: dayEndUtc(endDate),
    timeStart: dayStartUtc(startDate),
    timeEnd: dayEndUtc(endDate),
  }
  for (const spec of specs) spec.timeDimension = td
  return JSON.stringify(specs)
}

async function fetchMtd(): Promise<FeedMeMtdSummary | null> {
  const token = await resolveBearer()
  const businessId = process.env.FEEDME_BUSINESS_ID
  if (!token || !businessId) return null
  const file = queryFilePath()
  if (!existsSync(file)) return null
  let baseText: string
  try {
    baseText = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  if (baseText.includes('<<PASTE')) return null

  const asOf = businessToday()
  const monthStart = `${asOf.slice(0, 7)}-01`
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: rangePayload(baseText, monthStart, asOf),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const days = parseFeedMeDailyRows(await res.json())
    const operating = days.filter((d) => d.revenue > 0)
    const mtdRevenue = operating.reduce((sum, d) => sum + d.revenue, 0)
    const bestDayRevenue = operating.reduce((max, d) => Math.max(max, d.revenue), 0)
    return {
      monthStart,
      asOf,
      mtdRevenue: round2(mtdRevenue),
      mtdAverage: operating.length ? round2(mtdRevenue / operating.length) : 0,
      bestDayRevenue: round2(bestDayRevenue),
      operatingDays: operating.length,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── 7-day range summary (Revenue Analytics page) ─────────────────────────────

const WEEK_CACHE_FILE = resolve(process.cwd(), 'lib/feedme/.cache/last-7day.json')

export interface FeedMe7DaySummary {
  startDate: string
  endDate: string
  totalRevenue: number
  avgDaily: number
  bestDay: { date: string; revenue: number }
  worstDay: { date: string; revenue: number }
  operatingDays: number
  dailyList: DailySalesPoint[]
}

let weekMemo: { fetchedAt: string; value: FeedMe7DaySummary } | null = null

// Compute yesterday (YYYY-MM-DD) in MYT using UTC-safe arithmetic.
// Avoids timezone skew when setDate/getDate operate on the Date object
// (new Date with +08:00 suffix creates a Date whose UTC day may differ).
export function isoYesterday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d - 1))
  return prev.toISOString().slice(0, 10)
}

async function fetch7Day(): Promise<FeedMe7DaySummary | null> {
  const token = await resolveBearer()
  const businessId = process.env.FEEDME_BUSINESS_ID
  if (!token || !businessId) return null
  const file = queryFilePath()
  if (!existsSync(file)) return null
  let baseText: string
  try {
    baseText = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  if (baseText.includes('<<PASTE')) return null

  const asOf = businessToday()
  const endDate = isoYesterday(asOf) // last completed business day
  const d = new Date(`${endDate}T00:00:00+08:00`)
  d.setDate(d.getDate() - 6)
  const startDate = d.toISOString().slice(0, 10)

  const url = `${ENDPOINT_BASE}/${encodeURIComponent(businessId)}/postgres-query`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: rangePayload(baseText, startDate, endDate),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const days = parseFeedMeDailyRows(await res.json())

    // Include today if any data exists (revenue=0 means not opened yet or no sales)
    const todayPoint: DailySalesPoint = {
      date: asOf,
      revenue: 0,
      gross: 0,
      qty: 0,
      serviceCharge: 0,
      pax: 0,
    }
    const hasToday = days.some((d) => d.date === asOf)
    const dailyList = hasToday ? days : [...days, todayPoint]

    const operating = dailyList.filter((d) => d.revenue > 0)
    const totalRevenue = operating.reduce((sum, d) => sum + d.revenue, 0)
    const best = operating.reduce(
      (max, d) => (d.revenue > max.revenue ? d : max),
      operating[0] ?? { date: '—', revenue: 0 },
    )
    const worst = operating.reduce(
      (min, d) => (d.revenue < min.revenue ? d : min),
      operating[0] ?? { date: '—', revenue: 0 },
    )

    return {
      startDate,
      endDate,
      totalRevenue: round2(totalRevenue),
      avgDaily: operating.length ? round2(totalRevenue / operating.length) : 0,
      bestDay: { date: best.date, revenue: round2(best.revenue) },
      worstDay: { date: worst.date, revenue: round2(worst.revenue) },
      operatingDays: operating.length,
      dailyList,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Live 7-day range summary, throttled + last-successful fallback.
export async function getFeedMe7DayRange(): Promise<FeedMe7DaySummary | null> {
  const now = Date.now()
  if (weekMemo && now - Date.parse(weekMemo.fetchedAt) < CACHE_TTL_MS) return weekMemo.value

  const live = await fetch7Day()
  if (live) {
    weekMemo = { fetchedAt: new Date(now).toISOString(), value: live }
    writeJson(WEEK_CACHE_FILE, weekMemo)
    return live
  }
  if (weekMemo) return weekMemo.value
  const cached = readJson<{ fetchedAt: string; value: FeedMe7DaySummary }>(WEEK_CACHE_FILE)
  if (cached?.value) {
    weekMemo = cached
    return cached.value
  }
  return null
}

// Live month-to-date summary, throttled + last-successful fallback (like above).
export async function getFeedMeMonthToDate(): Promise<FeedMeMtdSummary | null> {
  const now = Date.now()
  if (mtdMemo && now - Date.parse(mtdMemo.fetchedAt) < CACHE_TTL_MS) return mtdMemo.value

  const live = await fetchMtd()
  if (live) {
    mtdMemo = { fetchedAt: new Date(now).toISOString(), value: live }
    writeJson(MTD_CACHE_FILE, mtdMemo)
    return live
  }
  if (mtdMemo) return mtdMemo.value
  const cached = readJson<{ fetchedAt: string; value: FeedMeMtdSummary }>(MTD_CACHE_FILE)
  if (cached?.value) {
    mtdMemo = cached
    return cached.value
  }
  return null
}
