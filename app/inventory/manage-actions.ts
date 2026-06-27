'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { computeDisplayStatus } from '@/lib/inventory/status'
import type { InventoryCatalogItem, InventoryCatalogStatus, ItemCreateData, ItemUpdateData } from '@/lib/inventory/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function fetchInventoryCatalogAction(): Promise<
  { ok: true; data: InventoryCatalogItem[] } | { ok: false; error: string }
> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('purchase_catalog')
      .select('id, name_zh, name_ms, category, unit, track_inventory, purchase_source')
      .eq('active', true)
      .eq('track_inventory', true)
      .order('seq')
    if (error) throw error
    return {
      ok: true,
      data: (data ?? []).map(row => ({
        id: row.id as number,
        name_zh: row.name_zh as string,
        name_ms: (row.name_ms as string) ?? null,
        category: row.category as string,
        unit: row.unit as string,
        trackInventory: Boolean(row.track_inventory),
        purchaseSource: (['china', 'both'].includes(row.purchase_source as string)
          ? row.purchase_source
          : 'local') as 'local' | 'china' | 'both',
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Returns the inventory status for every active inventory item that is linked
// to a catalog entry. Used by InventoryItemPicker for duplicate prevention.
export async function fetchInventoryStatusByCatalogAction(): Promise<
  { ok: true; data: InventoryCatalogStatus[] } | { ok: false; error: string }
> {
  try {
    await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('inventory_items')
      .select('catalog_id, category, reorder_level, reorder_point, inventory_stock_levels(current_quantity, last_counted_at)')
      .eq('outlet_id', OUTLET_ID)
      .eq('status', 'active')
      .not('catalog_id', 'is', null)

    if (error) return { ok: false, error: error.message }

    const result: InventoryCatalogStatus[] = (data ?? []).map(row => {
      const r = row as Record<string, unknown>
      const stockRows = r.inventory_stock_levels
      const stock = (Array.isArray(stockRows) ? stockRows[0] : stockRows) as Record<string, unknown> | null
      const currentQuantity = stock ? Number(stock.current_quantity ?? 0) : 0
      const lastCountedAt = stock ? (stock.last_counted_at as string | null) : null

      return {
        catalogId: r.catalog_id as number,
        currentQuantity,
        displayStatus: computeDisplayStatus({
          currentQuantity,
          reorderLevel: Number(r.reorder_level ?? 0),
          reorderPoint: r.reorder_point != null ? Number(r.reorder_point) : null,
          lastCountedAt,
          category: r.category as string,
        }),
      }
    })

    return { ok: true, data: result }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function createItemAction(
  data: ItemCreateData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await requireRole('owner', 'manager')

    const supabase = await createServerSupabaseClient()

    // Fetch name/category/unit from catalog — these are catalog-owned fields
    const { data: catalogRow, error: catalogError } = await supabase
      .from('purchase_catalog')
      .select('name_zh, category, unit')
      .eq('id', data.catalogId)
      .eq('active', true)
      .eq('track_inventory', true)
      .single()

    if (catalogError || !catalogRow) {
      return { ok: false, error: 'Catalog item not found or not trackable' }
    }

    if (data.trackOpened && data.initialOpenedQuantity > data.initialQuantity) {
      return { ok: false, error: 'Opened quantity cannot exceed total quantity' }
    }

    const { data: created, error: itemError } = await supabase
      .from('inventory_items')
      .insert({
        outlet_id: OUTLET_ID,
        catalog_id: data.catalogId,
        name: catalogRow.name_zh,
        category: catalogRow.category,
        unit: catalogRow.unit,
        track_opened: data.trackOpened,
        reorder_level: data.reorderLevel,
        reorder_point: data.reorderPoint,
        par_level: data.parLevel,
        lead_time_days: data.leadTimeDays,
        location: data.location,
        supplier: data.supplier,
        notes: data.notes,
        status: 'active',
      })
      .select('id')
      .single()

    if (itemError) {
      if (itemError.code === '23505') {
        return { ok: false, error: 'This catalog item already has an inventory entry' }
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

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('inventory_items')
      .update({
        category: data.category,
        unit: data.unit,
        track_opened: data.trackOpened,
        reorder_level: data.reorderLevel,
        reorder_point: data.reorderPoint,
        par_level: data.parLevel,
        lead_time_days: data.leadTimeDays,
        location: data.location,
        supplier: data.supplier,
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
