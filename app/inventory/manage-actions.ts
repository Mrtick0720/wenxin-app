'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ItemCreateData, ItemUpdateData } from '@/lib/inventory/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function createItemAction(
  data: ItemCreateData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const name = data.name.trim()
    if (!name) return { ok: false, error: 'Name is required' }
    if (!data.category) return { ok: false, error: 'Category is required' }
    if (!data.unit.trim()) return { ok: false, error: 'Unit is required' }

    if (data.trackOpened && data.initialOpenedQuantity > data.initialQuantity) {
      return { ok: false, error: 'Opened quantity cannot exceed total quantity' }
    }

    const supabase = await createServerSupabaseClient()

    const { data: created, error: itemError } = await supabase
      .from('inventory_items')
      .insert({
        outlet_id: OUTLET_ID,
        name,
        category: data.category,
        unit: data.unit.trim(),
        reorder_level: data.reorderLevel,
        reorder_point: data.reorderPoint,
        par_level: data.parLevel,
        lead_time_days: data.leadTimeDays,
        location: data.location,
        supplier: data.supplier,
        track_opened: data.trackOpened,
        notes: data.notes,
        status: 'active',
      })
      .select('id')
      .single()

    if (itemError) {
      if (itemError.code === '23505') {
        return { ok: false, error: 'An item with this name already exists' }
      }
      return { ok: false, error: itemError.message }
    }

    const { error: stockError } = await supabase
      .from('inventory_stock_levels')
      .insert({
        item_id: created.id,
        outlet_id: OUTLET_ID,
        current_quantity: data.initialQuantity,
        opened_quantity: data.trackOpened ? data.initialOpenedQuantity : 0,
        last_counted_at: data.initialQuantity > 0 ? new Date().toISOString() : null,
      })

    if (stockError) return { ok: false, error: stockError.message }

    return { ok: true, id: created.id }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function updateItemAction(
  id: number,
  data: ItemUpdateData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const name = data.name.trim()
    if (!name) return { ok: false, error: 'Name is required' }
    if (!data.category) return { ok: false, error: 'Category is required' }
    if (!data.unit.trim()) return { ok: false, error: 'Unit is required' }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('inventory_items')
      .update({
        name,
        category: data.category,
        unit: data.unit.trim(),
        reorder_level: data.reorderLevel,
        reorder_point: data.reorderPoint,
        par_level: data.parLevel,
        lead_time_days: data.leadTimeDays,
        location: data.location,
        supplier: data.supplier,
        track_opened: data.trackOpened,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('outlet_id', OUTLET_ID)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function deleteItemAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    // Block delete if any movement history exists
    const { count, error: countError } = await supabase
      .from('inventory_movements')
      .select('id', { count: 'exact', head: true })
      .eq('item_id', id)

    if (countError) return { ok: false, error: countError.message }
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: 'This item has history and cannot be deleted. Archive it instead.',
      }
    }

    // Hard delete — cascade removes stock_levels and adjustments rows
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('outlet_id', OUTLET_ID)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function archiveItemAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('inventory_items')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('outlet_id', OUTLET_ID)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
