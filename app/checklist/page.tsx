import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewChecklist, canViewAllChecklists } from '@/lib/checklist/permissions'
import { redirect } from 'next/navigation'
import ChecklistClient from './ChecklistClient'

export const dynamic = 'force-dynamic'

export default async function ChecklistPage() {
  const staff = await requireCurrentStaff()

  if (!canViewChecklist(staff.role)) {
    redirect('/access-denied')
  }

  const isManager = canViewAllChecklists(staff.role)

  return <ChecklistClient staff={staff} isManager={isManager} />
}
