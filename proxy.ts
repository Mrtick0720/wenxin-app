import { NextResponse, type NextRequest } from 'next/server'
import { getAuthRedirect } from '@/lib/auth/permissions'
import type { StaffRole } from '@/lib/auth/types'
import { createProxySupabaseClient } from '@/lib/supabase/proxy'

type LoginProfile = {
  role: StaffRole
  active: boolean
  must_change_password: boolean
}

function firstProfile(data: LoginProfile[] | LoginProfile | null) {
  return Array.isArray(data) ? data[0] ?? null : data
}

function redirectWithCookies(request: NextRequest, destination: string, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.getAll().forEach(cookie => {
    redirectResponse.cookies.set(cookie.name, cookie.value)
  })
  return redirectResponse
}

export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createProxySupabaseClient(request)
  const { data: claimsData } = await supabase.auth.getClaims()
  const authenticated = Boolean(claimsData?.claims?.sub)

  let profile: LoginProfile | null = null
  let sessionValid = false

  if (authenticated) {
    const [{ data: profileData }, { data: validData }] = await Promise.all([
      supabase.rpc('get_login_staff_profile'),
      supabase.rpc('is_current_staff_session_valid'),
    ])
    profile = firstProfile(profileData as LoginProfile[] | LoginProfile | null)
    sessionValid = validData === true
  }

  const destination = getAuthRedirect({
    path: request.nextUrl.pathname,
    authenticated,
    active: profile?.active,
    mustChangePassword: profile?.must_change_password,
    role: profile?.role,
    sessionValid,
  })

  if (destination) {
    if (authenticated && !sessionValid && destination.startsWith('/login')) {
      await supabase.rpc('end_current_staff_session', { reason: 'expired' })
      await supabase.auth.signOut({ scope: 'local' })
    }
    return redirectWithCookies(request, destination, getResponse())
  }

  return getResponse()
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|apple-touch-icon.png|manifest.json).*)',
  ],
}
