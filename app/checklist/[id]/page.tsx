import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewChecklist } from '@/lib/checklist/permissions'
import { redirect } from 'next/navigation'
import ChecklistDetailClient from './DetailClient'

export const dynamic = 'force-dynamic'

export default async function ChecklistDetailPage() {
  const staff = await requireCurrentStaff()

  if (!canViewChecklist(staff.role)) {
    redirect('/access-denied')
  }

  return <ChecklistDetailClient />
}
