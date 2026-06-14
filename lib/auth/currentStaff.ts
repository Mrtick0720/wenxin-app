import 'server-only'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CurrentStaff, StaffProfile, StaffRole } from './types'
import {
  SessionVerificationUnavailableError,
  classifyAuthError,
  classifySessionValidity,
} from './sessionVerification'

type LoginProfile = Pick<
  StaffProfile,
  'id' | 'staff_id' | 'display_name' | 'role' | 'active' | 'must_change_password'
>

function firstRow<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createServerSupabaseClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as { sub?: string; session_id?: string } | undefined

  if (claimsError) {
    if (classifyAuthError(claimsError) === 'invalid') return null
    throw new SessionVerificationUnavailableError()
  }
  if (!claims?.sub || !claims.session_id) return null

  const [
    { data: profileData, error: profileError },
    { data: validData, error: validityError },
  ] = await Promise.all([
    supabase.rpc('get_login_staff_profile'),
    supabase.rpc('is_current_staff_session_valid'),
  ])

  const profile = firstRow(profileData as LoginProfile[] | LoginProfile | null)
  if (profileError || classifySessionValidity(validData, validityError) === 'unavailable') {
    throw new SessionVerificationUnavailableError()
  }
  if (!profile?.active || validData !== true) return null

  const { data: session, error: sessionError } = await supabase
    .from('staff_sessions')
    .select('expires_at')
    .eq('id', claims.session_id)
    .maybeSingle()

  if (sessionError) throw new SessionVerificationUnavailableError()
  if (!session?.expires_at) return null

  return {
    id: profile.id,
    staffId: profile.staff_id,
    displayName: profile.display_name,
    role: profile.role,
    mustChangePassword: profile.must_change_password,
    expiresAt: session.expires_at,
  }
}

export async function requireCurrentStaff() {
  const staff = await getCurrentStaff()
  if (!staff) redirect('/login')
  if (staff.mustChangePassword) redirect('/change-password')
  return staff
}

export async function requireRole(...roles: StaffRole[]) {
  const staff = await requireCurrentStaff()
  if (!roles.includes(staff.role)) redirect('/access-denied')
  return staff
}
