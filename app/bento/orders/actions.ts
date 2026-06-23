'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: unknown): ActionResult<never> {
  const msg = error instanceof Error ? error.message
    : error != null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  return { ok: false, error: msg }
}

export async function updateOrderAction(
  orderId: number,
  payload: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    await requireRole('owner', 'manager', 'front_desk')
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('bento_orders')
      .update(payload)
      .eq('id', orderId)
      .select('*')
      .single()

    if (error) throw error
    return { ok: true, data: data as Record<string, unknown> }
  } catch (e) { return fail(e) }
}
