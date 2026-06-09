import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canViewOwnAttendance, canViewAllAttendance } from '@/lib/attendance/permissions'
import { redirect } from 'next/navigation'
import AttendanceClient from './AttendanceClient'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const staff = await requireCurrentStaff()

  if (!canViewOwnAttendance(staff.role)) {
    redirect('/access-denied')
  }

  const isManager = canViewAllAttendance(staff.role)

  return <AttendanceClient staff={staff} isManager={isManager} />
}
