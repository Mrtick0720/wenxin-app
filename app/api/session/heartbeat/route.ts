import { NextResponse } from 'next/server'
import { getCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  const staff = await getCurrentStaff()
  if (!staff) {
    return NextResponse.json({ error: 'Session ended' }, { status: 401 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('touch_staff_session')
  if (error) {
    return NextResponse.json({ error: 'Session ended' }, { status: 401 })
  }

  return NextResponse.json({ expiresAt: staff.expiresAt })
}
