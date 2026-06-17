import { requireRole } from '@/lib/auth/currentStaff'
import { listRecords, getSummary } from '@/lib/purchaseLedger/service'
import { computeKpi } from '@/lib/purchaseLedger/kpi'
import {
  canViewPurchaseCosts,
  canDeletePurchase,
  canExportPurchase,
} from '@/lib/purchaseLedger/permissions'
import { businessToday } from '@/lib/purchaseLedger/time'
import PurchaseClient from './PurchaseClient'

export const dynamic = 'force-dynamic'

export default async function PurchasePage() {
  const staff = await requireRole('owner', 'manager', 'kitchen')

  const [records, summary, kpi] = await Promise.all([
    listRecords(staff.role, {}),
    getSummary(staff.role),
    computeKpi(staff.role),
  ])

  return (
    <PurchaseClient
      role={staff.role}
      today={businessToday()}
      initialRecords={records}
      initialSummary={summary}
      initialKpi={kpi}
      perms={{
        canViewCosts: canViewPurchaseCosts(staff.role),
        canDelete: canDeletePurchase(staff.role),
        canExport: canExportPurchase(staff.role),
      }}
    />
  )
}
