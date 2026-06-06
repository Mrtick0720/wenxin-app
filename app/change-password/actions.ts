'use server'

import { redirect } from 'next/navigation'
import { validatePasswordChange } from '@/lib/auth/permissions'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type ChangePasswordState = {
  error: string
}

export async function changePasswordAction(
  _previousState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  const validation = validatePasswordChange(password, confirmation)

  if (!validation.ok) return { error: validation.error }

  const supabase = await createServerSupabaseClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims?.sub) {
    redirect('/login')
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return { error: 'Unable to update your password. Please try again.' }
  }

  const { error: profileError } = await supabase.rpc('complete_first_password_change')
  if (profileError) {
    return { error: 'Password updated, but account setup could not finish. Please sign in again.' }
  }

  redirect('/')
}
