import 'server-only'

// App-side reader for the FeedMe relay cache (see
// supabase/migrations/20260614_feedme_relay_cache.sql). The Vercel app cannot
// reach FeedMe directly (Cloudflare 403s datacenter IPs), so it reads the latest
// parsed result that the relay job (scripts/feedme-push-to-supabase.ts) wrote to
// Supabase. Returns the last successful value — never fabricated — or null.

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type {
  FeedMeDailyRevenue,
  FeedMeMtdSummary,
  FeedMe7DaySummary,
} from './liveDailySales'

type RelayKind = 'daily' | 'mtd' | 'week'

async function readRelay<T>(kind: RelayKind): Promise<T | null> {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('feedme_relay_cache')
      .select('payload')
      .eq('kind', kind)
      .maybeSingle()
    if (error || !data?.payload) return null
    return data.payload as T
  } catch {
    return null
  }
}

export function readRelayDaily(): Promise<FeedMeDailyRevenue | null> {
  return readRelay<FeedMeDailyRevenue>('daily')
}

export function readRelayMtd(): Promise<FeedMeMtdSummary | null> {
  return readRelay<FeedMeMtdSummary>('mtd')
}

export function readRelayWeek(): Promise<FeedMe7DaySummary | null> {
  return readRelay<FeedMe7DaySummary>('week')
}
