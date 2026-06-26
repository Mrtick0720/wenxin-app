import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewCashier } from '@/lib/cashier/permissions'
import { redirect } from 'next/navigation'
import CashierClient from './CashierClient'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  const staff = await requireCurrentStaff()
  if (!canViewCashier(staff.role)) redirect('/access-denied')
  return <CashierClient />
}
