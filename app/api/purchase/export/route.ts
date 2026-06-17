import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentStaff } from '@/lib/auth/currentStaff'
import { canExportPurchase } from '@/lib/purchaseLedger/permissions'
import { listRecords } from '@/lib/purchaseLedger/service'
import { recordsToCsv, csvFilename } from '@/lib/purchaseLedger/csv'
import { businessToday } from '@/lib/purchaseLedger/time'
import type { PurchaseFilters } from '@/lib/purchaseLedger/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const staff = await getCurrentStaff().catch(() => null)
  if (!staff) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (!canExportPurchase(staff.role)) {
    return NextResponse.json({ error: 'Not permitted.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const filters: PurchaseFilters = {
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    category: sp.get('category') || undefined,
    supplier: sp.get('supplier') || undefined,
    purchaser: sp.get('purchaser') || undefined,
  }

  const records = await listRecords(staff.role, filters)
  const csv = recordsToCsv(records)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(businessToday())}"`,
      'Cache-Control': 'no-store',
    },
  })
}
