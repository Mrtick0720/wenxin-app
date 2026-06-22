'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMondayOfWeek } from '@/lib/dateUtils'

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
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner', 'manager', 'front_desk')
    const supabase = await createServerSupabaseClient()

    // If switching to light/flavorful, populate compartment fields from weekly menu
    const menuType = payload.menu_type as string | undefined
    if (menuType === 'light' || menuType === 'flavorful') {
      const date = payload.date as string
      if (date) {
        const ws = getMondayOfWeek(date)
        const d = new Date(date + 'T00:00:00')
        const dow = (d.getDay() + 6) % 7
        const { data: assignments } = await supabase
          .from('bento_weekly_menu_assignments')
          .select('*, bento_menu_variants(code), bento_proteins(description), bento_vegetables(description), bento_staples(description)')
          .eq('week_start', ws).eq('day_of_week', dow)
        if (assignments) {
          const match = assignments.find(
            a => (a.bento_menu_variants as Record<string, unknown> | null)?.code === menuType
          ) as Record<string, unknown> | undefined
          if (match) {
            const protein = match.bento_proteins as Record<string, unknown> | null
            const vegetable = match.bento_vegetables as Record<string, unknown> | null
            const staple = match.bento_staples as Record<string, unknown> | null
            const compA = (protein?.description as string) ?? null
            const compB = (vegetable?.description as string) ?? null
            const compC = (staple?.description as string) ?? null
            payload.compartment_a = compA
            payload.compartment_b = compB
            payload.compartment_c = compC
            payload.items = [compA, compB, compC].filter(Boolean).join(' / ')
          }
        }
      }
    }

    const { error } = await supabase
      .from('bento_orders')
      .update(payload)
      .eq('id', orderId)

    if (error) throw error
    return { ok: true, data: null }
  } catch (e) { return fail(e) }
}
