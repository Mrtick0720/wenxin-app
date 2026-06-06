'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function logoutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.rpc('end_current_staff_session', { reason: 'logout' })
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
