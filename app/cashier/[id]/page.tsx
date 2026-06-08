import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewCashier } from '@/lib/cashier/permissions'
import { redirect } from 'next/navigation'
import ShiftDetailClient from './DetailClient'

export const dynamic = 'force-dynamic'

export default async function CashierShiftDetailPage() {
  const staff = await requireCurrentStaff()

  if (!canViewCashier(staff.role)) {
    redirect('/access-denied')
  }

  return <ShiftDetailClient />
}
