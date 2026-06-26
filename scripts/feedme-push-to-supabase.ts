/**
 * FeedMe → Supabase relay.
 *
 * WHY: Vercel cannot reach FeedMe (Cloudflare 403s datacenter IPs). This script
 * runs on a machine whose IP FeedMe allows (the restaurant's broadband: a Mac or
 * an always-on device), fetches today's revenue + month-to-date + the 7-day
 * range using the SAME parsers the app uses, and writes the results to the
 * `feedme_relay_cache` table. The Vercel app then reads from Supabase.
 *
 * Run once (for cron):   npm run feedme:push
 * Run continuously:      npm run feedme:push -- --loop          (every 180s)
 *                        npm run feedme:push -- --loop=300      (custom seconds)
 *
 * Env: reads .env.local automatically (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, FEEDME_REFRESH_TOKEN, FEEDME_BUSINESS_ID,
 * FEEDME_RESTAURANT_ID). Never prints tokens.
 */

import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  getFeedMeDailyRevenue,
  getFeedMeMonthToDate,
  getFeedMe7DayRange,
} from '../lib/feedme/liveDailySales'
import { businessToday } from '../lib/feedme/parseQueryResult'
import { parseCashDrawer, type ParsedCashDrawerSession } from '../lib/feedme/parseCashDrawer'
import { getFeedMeIdToken, hasRefreshToken } from '../lib/feedme/refreshIdToken'

// Load .env.local if present (cron/standalone has no Next auto-load). In a
// managed environment the vars may already be set, so a missing file is fine.
try {
  process.loadEnvFile(resolve(process.cwd(), '.env.local'))
} catch {
  // env may be provided by the host (systemd, launchd, container) — continue.
}

const OUTLET_ID   = '00000000-0000-0000-0000-000000000001'
const ENDPOINT_BASE = 'https://query-engine.feedmeapi.com/report-query'
const FETCH_TIMEOUT_MS = 8000

function ts(): string {
  return new Date().toISOString()
}

function dayStartUtc(date: string): string {
  return new Date(`${date}T00:00:00.000+08:00`).toISOString()
}
function dayEndUtc(date: string): string {
  return new Date(`${date}T23:59:59.999+08:00`).toISOString()
}

function cashDrawerQueryFilePath(): string {
  return process.env.FEEDME_CASH_DRAWER_QUERY_FILE
    ? resolve(process.env.FEEDME_CASH_DRAWER_QUERY_FILE)
    : resolve(process.cwd(), 'scripts/feedme-cash-drawer.query.json')
}

async function resolveBearer(): Promise<string | null> {
  if (hasRefreshToken()) {
    const minted = await getFeedMeIdToken()
    if (minted) return minted
  }
  return process.env.FEEDME_BEARER_TOKEN ?? null
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local).'
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type CashDrawerFetchResult = {
  sessions: ParsedCashDrawerSession[]
  rawPayload: unknown
}

async function fetchCashDrawerSessions(date: string): Promise<CashDrawerFetchResult | null> {
  const token     = await resolveBearer()
  const businessId = process.env.FEEDME_BUSINESS_ID
  if (!token)      { console.warn(`[cash-drawer] no bearer token`);          return null }
  if (!businessId) { console.warn(`[cash-drawer] FEEDME_BUSINESS_ID not set`); return null }

  const queryFile = cashDrawerQueryFilePath()
  if (!existsSync(queryFile)) {
    // Query file optional — skip silently so revenue relay still runs
    return null
  }

  let bodyText: string
  try {
    bodyText = readFileSync(queryFile, 'utf8')
  } catch {
    console.warn(`[cash-drawer] failed to read query file: ${queryFile}`)
    return null
  }
  if (bodyText.includes('<<PASTE')) {
    console.warn(`[cash-drawer] query file still has <<PASTE placeholder — skipping`)
    return null
  }

  // Substitute placeholders and pin timeDimension to the given business date
  bodyText = bodyText.split('${FEEDME_BUSINESS_ID}').join(businessId)
  if (process.env.FEEDME_RESTAURANT_ID) {
    bodyText = bodyText.split('${FEEDME_RESTAURANT_ID}').join(process.env.FEEDME_RESTAURANT_ID)
  }
  const td = {
    start:     dayStartUtc(date),
    end:       dayEndUtc(date),
    timeStart: dayStartUtc(date),
    timeEnd:   dayEndUtc(date),
  }
  let specs: Array<Record<string, unknown>>
  try {
    specs = JSON.parse(bodyText) as Array<Record<string, unknown>>
  } catch {
    console.warn(`[cash-drawer] query file is not valid JSON — skipping`)
    return null
  }
  for (const spec of specs) spec.timeDimension = td
  const body = JSON.stringify(specs)

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
      console.warn(`[cash-drawer] FeedMe HTTP ${res.status} ${res.statusText}`)
      return null
    }
    const rawPayload = await res.json()
    const sessions  = parseCashDrawer(rawPayload)
    console.log(`[cash-drawer] parsed ${sessions.length} counter(s) for ${date}`)
    return { sessions, rawPayload }
  } catch (err) {
    console.warn(`[cash-drawer] fetch error: ${(err as Error).message}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pushCashDrawerSessions(supabase: ReturnType<typeof createClient<any>>, sessions: ParsedCashDrawerSession[], rawPayload: unknown, date: string): Promise<void> {
  if (sessions.length === 0) return

  // Skip counters that were manually imported — FeedMe relay must not overwrite them
  const { data: manualRows } = await supabase
    .from('cash_drawer_sessions')
    .select('counter')
    .eq('business_date', date)
    .eq('outlet_id', OUTLET_ID)
    .eq('source', 'manual_import')

  const manualCounters = new Set<string>(
    (manualRows ?? []).map((r: { counter: string }) => r.counter)
  )

  const rows = sessions
    .filter((s) => !manualCounters.has(s.counter))
    .map((s) => ({
      business_date:      date,
      counter:            s.counter,
      outlet_id:          OUTLET_ID,
      outlet_name:        s.outletName,
      open_time:          s.openTime,
      close_time:         s.closeTime,
      opened_by:          s.openedBy,
      closed_by:          s.closedBy,
      opening_float:      s.openingFloat,
      closing_float:      s.closingFloat,
      cash_sales:         s.cashSales,
      pay_in:             s.payIn,
      pay_out:            s.payOut,
      alipay:             s.alipay,
      duitnow:            s.duitnow,
      maybank_qr:         s.maybankQr,
      touchngo:           s.touchngo,
      wechat:             s.wechat,
      source:             'feedme_relay' as const,
      raw_source_payload: rawPayload,
      imported_at:        new Date().toISOString(),
      imported_by:        null,
    }))

  if (rows.length === 0) {
    console.log(`[cash-drawer] all ${sessions.length} counter(s) have manual_import rows — skipping upsert`)
    return
  }

  const { error } = await supabase
    .from('cash_drawer_sessions')
    .upsert(rows, { onConflict: 'business_date,counter,outlet_id' })

  if (error) {
    console.error(`[cash-drawer] upsert failed: ${error.message}`)
    return
  }

  console.log(`✓ ${ts()} cash-drawer: upserted ${rows.length} counter(s) for ${date}`)
}

function bizYesterday(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

async function pushOnce(): Promise<boolean> {
  const supabase = adminClient()
  const today     = businessToday()
  const yesterday = bizYesterday(today)

  const [daily, mtd, week, cashDrawerToday, cashDrawerYesterday] = await Promise.all([
    getFeedMeDailyRevenue(),
    getFeedMeMonthToDate(),
    getFeedMe7DayRange(),
    fetchCashDrawerSessions(today),
    fetchCashDrawerSessions(yesterday),
  ])

  const rows: { kind: string; payload: unknown }[] = []
  if (daily) rows.push({ kind: 'daily', payload: daily })
  if (mtd) rows.push({ kind: 'mtd', payload: mtd })
  if (week) rows.push({ kind: 'week', payload: week })

  if (rows.length === 0) {
    console.error(
      `✗ ${ts()} FeedMe returned no data (token/IP/network). Nothing written; ` +
        `existing Supabase values are kept.`
    )
    return false
  }

  const fetchedAt = ts()
  const { error } = await supabase
    .from('feedme_relay_cache')
    .upsert(
      rows.map(r => ({ kind: r.kind, payload: r.payload, fetched_at: fetchedAt, updated_at: fetchedAt })),
      { onConflict: 'kind' }
    )

  if (error) {
    console.error(`✗ ${ts()} Supabase upsert failed: ${error.message}`)
    return false
  }

  const todayRevenue = daily ? (daily.value.revenue as number) : null
  console.log(
    `✓ ${ts()} wrote [${rows.map(r => r.kind).join(', ')}]` +
      (todayRevenue !== null ? ` | today revenue=RM ${todayRevenue.toFixed(2)}` : '')
  )

  // Push yesterday's CLOSED sessions first (final reconciliation). Only closed
  // sessions (closeTime set) are imported for a prior date — open sessions on
  // a previous day are stale/abandoned and should not overwrite manual imports.
  if (cashDrawerYesterday) {
    const closedYesterday = cashDrawerYesterday.sessions.filter(s => s.closeTime !== null)
    if (closedYesterday.length > 0) {
      await pushCashDrawerSessions(supabase, closedYesterday, cashDrawerYesterday.rawPayload, yesterday)
    }
  }

  // Push today's sessions (live, may be open or closed).
  if (cashDrawerToday) {
    await pushCashDrawerSessions(supabase, cashDrawerToday.sessions, cashDrawerToday.rawPayload, today)
  }

  return true
}

function parseLoopSeconds(): number | null {
  const arg = process.argv.find(a => a === '--loop' || a.startsWith('--loop='))
  if (!arg) return null
  if (arg === '--loop') return 180
  const n = Number(arg.split('=')[1])
  return Number.isFinite(n) && n >= 30 ? n : 180
}

async function main() {
  const loopSeconds = parseLoopSeconds()

  if (loopSeconds === null) {
    const ok = await pushOnce()
    process.exit(ok ? 0 : 1)
  }

  console.log(`↻ ${ts()} relay loop started — every ${loopSeconds}s. Ctrl+C to stop.`)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pushOnce()
    } catch (e) {
      console.error(`✗ ${ts()} ${(e as Error).message}`)
    }
    await new Promise(r => setTimeout(r, loopSeconds * 1000))
  }
}

main().catch(e => {
  console.error(`✗ ${ts()} ${(e as Error).message}`)
  process.exit(1)
})
