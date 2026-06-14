// Server-side refresh endpoint for HeroCard revenue metrics (slides 1 & 2).
// GET /api/feedme/revenue-refresh → combined daily + MTD data for auto-refresh.
// Data is served from the Supabase relay cache (the relay job fetches FeedMe from
// an allowed IP; Vercel cannot reach FeedMe directly). See lib/feedme/relayStore.

import { NextResponse } from 'next/server'
import { readRelayDaily, readRelayMtd, readRelayWeek } from '@/lib/feedme/relayStore'
import { businessToday } from '@/lib/feedme/parseQueryResult'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [daily, mtd, week] = await Promise.all([
    readRelayDaily(),
    readRelayMtd(),
    readRelayWeek(),
  ])

  const feedMeDate = daily?.value.date ?? null
  const feedMeRevenueValue = daily?.value.revenue ?? null
  const bizToday = businessToday()
  const revenueIsToday = feedMeDate !== null && feedMeDate === bizToday
  const revenueTotal = revenueIsToday ? feedMeRevenueValue : null

  // Yesterday: prefer the 7-day range data (endDate = yesterday MYT).
  const bizYesterday = (() => {
    const [y, m, d] = bizToday.split('-').map(Number)
    const prev = new Date(Date.UTC(y, m - 1, d - 1))
    return prev.toISOString().slice(0, 10)
  })()
  const yesterdayFromWeek =
    week?.dailyList?.find((d) => d.date === bizYesterday)?.revenue ?? null
  const revenueYesterday = revenueIsToday ? yesterdayFromWeek : feedMeRevenueValue

  // Growth vs yesterday
  const growthPercent =
    revenueTotal !== null && revenueYesterday !== null && revenueYesterday !== 0
      ? ((revenueTotal - revenueYesterday) / revenueYesterday) * 100
      : null

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    daily: { revenueTotal, revenueYesterday, growthPercent },
    mtd: {
      mtdRevenue: mtd?.mtdRevenue ?? null,
      mtdAverage: mtd?.mtdAverage ?? null,
      bestDayRevenue: mtd?.bestDayRevenue ?? null,
    },
  })
}
