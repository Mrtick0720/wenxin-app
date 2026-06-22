import { requireRole } from '@/lib/auth/currentStaff'
import { listRecords, getSummary } from '@/lib/purchaseLedger/service'
import { computeKpi } from '@/lib/purchaseLedger/kpi'
import {
  canViewPurchaseCosts,
  canDeletePurchase,
  canExportPurchase,
} from '@/lib/purchaseLedger/permissions'
import { businessToday } from '@/lib/purchaseLedger/time'
import { fetchChecklistAction } from './checklist-actions'
import PurchaseClient from './PurchaseClient'

export const dynamic = 'force-dynamic'

export default async function PurchasePage() {
  const staff = await requireRole('owner', 'manager', 'kitchen', 'front_desk')

  // Fetch all data in parallel — checklist included so ChecklistSection
  // hydrates immediately from SSR without a separate client-side fetch on mount.
  const [records, summary, kpi, checklistRes] = await Promise.all([
    listRecords(staff.role, {}),
    getSummary(staff.role),
    computeKpi(staff.role),
    fetchChecklistAction(),
  ])

  return (
    <PurchaseClient
      role={staff.role}
      today={businessToday()}
      initialRecords={records}
      initialSummary={summary}
      initialKpi={kpi}
      initialChecklist={checklistRes.ok ? checklistRes.data : undefined}
      purchaserName={staff.displayName}
      perms={{
        canViewCosts: canViewPurchaseCosts(staff.role),
        canDelete: canDeletePurchase(staff.role),
        canExport: canExportPurchase(staff.role),
      }}
    />
  )
}
