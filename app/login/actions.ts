'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { normalizeStaffId, staffIdToEmail, isValidStaffId } from '@/lib/auth/permissions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/auth/types'

export type LoginState = {
  error: string
}

type LoginProfile = {
  id: string
  staff_id: string
  display_name: string
  role: StaffRole
  active: boolean
  must_change_password: boolean
}

function firstProfile(data: LoginProfile[] | LoginProfile | null) {
  return Array.isArray(data) ? data[0] ?? null : data
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const staffId = normalizeStaffId(String(formData.get('staffId') ?? ''))
  const password = String(formData.get('password') ?? '')

  if (!isValidStaffId(staffId) || !password) {
    return { error: 'Staff ID or password is incorrect.' }
  }

  const supabase = await createServerSupabaseClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: staffIdToEmail(staffId),
    password,
  })

  if (signInError) {
    return { error: 'Staff ID or password is incorrect.' }
  }

  const { data: profileData, error: profileError } = await supabase.rpc('get_login_staff_profile')
  const profile = firstProfile(profileData as LoginProfile[] | LoginProfile | null)

  if (profileError || !profile) {
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'Staff ID or password is incorrect.' }
  }

  if (!profile.active) {
    await supabase.auth.signOut({ scope: 'local' })
    redirect('/account-disabled')
  }

  const headerStore = await headers()
  const userAgent = headerStore.get('user-agent') ?? 'Personal device'
  const { error: sessionError } = await supabase.rpc('start_staff_session', {
    device_summary: userAgent.slice(0, 240),
  })

  if (sessionError) {
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'Unable to start your session. Please try again.' }
  }

  redirect(profile.must_change_password ? '/change-password' : '/')
}
