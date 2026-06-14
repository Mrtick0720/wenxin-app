// Server-side refresh endpoint for today's FeedMe revenue.
// GET /api/feedme/daily-revenue → safe JSON only (never token, never raw response).
// Upstream throttling lives in getFeedMeDailyRevenue() (3-min TTL).

import { NextResponse } from 'next/server'
import { getFeedMeDailyRevenue } from '@/lib/feedme/liveDailySales'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await getFeedMeDailyRevenue()

  if (!result) {
    // No live data and no last-successful value — caller shows "—".
    return NextResponse.json({ ok: false, source: null, data: null })
  }

  const v = result.value
  return NextResponse.json({
    ok: true,
    source: result.source, // 'live' | 'cache'
    data: {
      date: v.date,
      revenue: v.revenue,
      gross: v.gross,
      qty: v.qty,
      pax: v.pax,
      serviceCharge: v.serviceCharge,
      rounding: v.rounding,
      fetchedAt: result.fetchedAt,
    },
  })
}
