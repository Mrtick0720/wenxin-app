'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canCountCategory } from '@/lib/inventory/permissions'
import type { CountItem, CountEntry } from '@/lib/inventory/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function fetchCountItemsAction(
  category: string,
): Promise<{ ok: true; data: CountItem[] } | { ok: false; error: string }> {
  try {
    const staff = await requireRole('owner', 'manager', 'kitchen', 'front_desk')

    if (!canCountCategory(staff.role, category)) {
      return { ok: false, error: `Your role cannot count ${category}` }
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        id,
        name,
        unit,
        category,
        track_opened,
        inventory_stock_levels!inner (
          current_quantity,
          opened_quantity
        )
      `)
      .eq('category', category)
      .eq('status', 'active')
      .eq('outlet_id', OUTLET_ID)
      .eq('inventory_stock_levels.outlet_id', OUTLET_ID)
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, error: error.message }
    }

    const items: CountItem[] = (data ?? []).map((row) => {
      const stockLevel = Array.isArray(row.inventory_stock_levels)
        ? row.inventory_stock_levels[0]
        : row.inventory_stock_levels

      return {
        id: row.id,
        name: row.name,
        unit: row.unit,
        category: row.category,
        trackOpened: Boolean(row.track_opened),
        currentQuantity: stockLevel?.current_quantity ?? 0,
        openedQuantity: stockLevel?.opened_quantity ?? 0,
      }
    })

    return { ok: true, data: items }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function saveCountAction(
  entries: CountEntry[],
  category: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const staff = await requireRole('owner', 'manager', 'kitchen', 'front_desk')

    if (!canCountCategory(staff.role, category)) {
      return { ok: false, error: `Your role cannot count ${category}` }
    }

    if (!entries || entries.length === 0) {
      return { ok: false, error: 'No items to save' }
    }

    for (const entry of entries) {
      if (entry.new_quantity < 0) {
        return { ok: false, error: 'Quantities cannot be negative' }
      }
      if (entry.opened_quantity > entry.new_quantity) {
        return { ok: false, error: 'Opened quantity cannot exceed total quantity' }
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.rpc('save_inventory_count', {
      p_entries: entries,
      p_category: category,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
