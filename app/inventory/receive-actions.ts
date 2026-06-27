'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function receiveStockAction(
  itemId: number,
  quantity: number,
  notes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    if (quantity <= 0) {
      return { ok: false, error: 'Received quantity must be greater than zero' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.rpc('receive_inventory_stock', {
      p_item_id: itemId,
      p_quantity: quantity,
      p_notes: notes ?? null,
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
