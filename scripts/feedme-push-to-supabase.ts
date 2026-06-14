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
import { createClient } from '@supabase/supabase-js'
import {
  getFeedMeDailyRevenue,
  getFeedMeMonthToDate,
  getFeedMe7DayRange,
} from '../lib/feedme/liveDailySales'

// Load .env.local if present (cron/standalone has no Next auto-load). In a
// managed environment the vars may already be set, so a missing file is fine.
try {
  process.loadEnvFile(resolve(process.cwd(), '.env.local'))
} catch {
  // env may be provided by the host (systemd, launchd, container) — continue.
}

function ts(): string {
  return new Date().toISOString()
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

async function pushOnce(): Promise<boolean> {
  const supabase = adminClient()

  const [daily, mtd, week] = await Promise.all([
    getFeedMeDailyRevenue(),
    getFeedMeMonthToDate(),
    getFeedMe7DayRange(),
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
