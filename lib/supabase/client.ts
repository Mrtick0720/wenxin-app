import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are not configured.')
  }

  return { url, anonKey }
}

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    const { url, anonKey } = getPublicSupabaseConfig()
    browserClient = createBrowserClient(url, anonKey)
  }

  return browserClient
}

export const supabase = createBrowserSupabaseClient()
