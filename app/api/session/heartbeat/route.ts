import { NextResponse } from 'next/server'
import { getCurrentStaff } from '@/lib/auth/currentStaff'
import {
  isConfirmedStaffSessionEnded,
  isSessionVerificationUnavailableError,
} from '@/lib/auth/sessionVerification'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  let staff
  try {
    staff = await getCurrentStaff()
  } catch (error) {
    if (isSessionVerificationUnavailableError(error)) {
      return NextResponse.json(
        { error: 'Session verification unavailable' },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
    return NextResponse.json(
      { error: 'Session verification unavailable' },
      { status: 503, headers: { 'Retry-After': '5' } }
    )
  }

  if (!staff) {
    return NextResponse.json({ error: 'Session ended' }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('touch_staff_session')
  if (error) {
    if (isConfirmedStaffSessionEnded(error)) {
      return NextResponse.json({ error: 'Session ended' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Session verification unavailable' },
      { status: 503, headers: { 'Retry-After': '5' } }
    )
  }

  return NextResponse.json({ expiresAt: staff.expiresAt })
}
