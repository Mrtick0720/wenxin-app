// ── Inventory Repository Layer ──
// Data access for inventory operations.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  InventoryItem,
  InventoryStockLevel,
  InventoryMovement,
  InventoryAdjustment,
} from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Inventory Items
// ═══════════════════════════════════════════════════════════════════

function mapItemRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    name: row.name as string,
    category: row.category as string,
    unit: row.unit as string,
    reorderLevel: Number(row.reorder_level ?? 0),
    reorderPoint: row.reorder_point != null ? Number(row.reorder_point) : null,
    leadTimeDays: row.lead_time_days != null ? Number(row.lead_time_days) : null,
    location: (row.location as string) ?? null,
    supplier: (row.supplier as string) ?? null,
    status: row.status as InventoryItem['status'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createInventoryItem(data: {
  name: string
  category: string
  unit: string
  reorderLevel?: number
  notes?: string | null
}): Promise<InventoryItem> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('inventory_items')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      name: data.name.trim(),
      category: data.category,
      unit: data.unit.trim(),
      reorder_level: data.reorderLevel ?? 0,
      notes: data.notes ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  // Initialize stock level to zero
  await supabase.from('inventory_stock_levels').insert({
    item_id: created.id,
    outlet_id: DEFAULT_OUTLET_ID,
    current_quantity: 0,
  })

  return mapItemRow(created)
}

export async function updateInventoryItem(
  itemId: number,
  updates: {
    name?: string
    category?: string
    unit?: string
    reorderLevel?: number
    status?: string
    notes?: string | null
  },
): Promise<InventoryItem> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = {}
  if (updates.name !== undefined) db.name = updates.name
  if (updates.category !== undefined) db.category = updates.category
  if (updates.unit !== undefined) db.unit = updates.unit
  if (updates.reorderLevel !== undefined) db.reorder_level = updates.reorderLevel
  if (updates.status !== undefined) db.status = updates.status
  if (updates.notes !== undefined) db.notes = updates.notes

  const { data, error } = await supabase
    .from('inventory_items')
    .update(db)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) throw error
  return mapItemRow(data)
}

export async function findInventoryItemById(
  itemId: number,
): Promise<InventoryItem | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle()

  if (error) throw error
  return data ? mapItemRow(data) : null
}

export async function findInventoryItems(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<InventoryItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('outlet_id', outletId)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapItemRow)
}

// ═══════════════════════════════════════════════════════════════════
// Stock Levels
// ═══════════════════════════════════════════════════════════════════

function mapStockLevelRow(row: Record<string, unknown>): InventoryStockLevel {
  return {
    id: row.id as number,
    itemId: row.item_id as number,
    outletId: row.outlet_id as string,
    currentQuantity: Number(row.current_quantity ?? 0),
    openedQuantity: Number(row.opened_quantity ?? 0),
    onOrderQuantity: Number(row.on_order_quantity ?? 0),
    lastCountedAt: (row.last_counted_at as string) ?? null,
    lastUpdatedAt: row.last_updated_at as string,
  }
}

export async function getStockLevel(
  itemId: number,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<InventoryStockLevel | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_stock_levels')
    .select('*')
    .eq('item_id', itemId)
    .eq('outlet_id', outletId)
    .maybeSingle()

  if (error) throw error
  return data ? mapStockLevelRow(data) : null
}

export async function updateStockLevel(
  itemId: number,
  newQuantity: number,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<InventoryStockLevel> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_stock_levels')
    .upsert({
      item_id: itemId,
      outlet_id: outletId,
      current_quantity: newQuantity,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'item_id, outlet_id' })
    .select('*')
    .single()

  if (error) throw error
  return mapStockLevelRow(data)
}

export async function findLowStockItems(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Array<{ item: InventoryItem; stock: InventoryStockLevel }>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, inventory_stock_levels!inner(*)')
    .eq('outlet_id', outletId)
    .eq('status', 'active')
    .filter('inventory_stock_levels.current_quantity', 'lte', supabase.schema as never)

  // Fallback: query items and filter manually
  if (error || !data) {
    const items = await findInventoryItems(outletId)
    const result: Array<{ item: InventoryItem; stock: InventoryStockLevel }> = []
    for (const item of items) {
      if (item.status !== 'active') continue
      const stock = await getStockLevel(item.id, outletId)
      if (stock && stock.currentQuantity <= item.reorderLevel) {
        result.push({ item, stock })
      }
    }
    return result
  }

  return (data as Array<Record<string, unknown>>).map(row => ({
    item: mapItemRow(row),
    stock: {
      id: (row.inventory_stock_levels as Record<string, unknown>)?.id as number ?? 0,
      itemId: row.id as number,
      outletId: row.outlet_id as string,
      currentQuantity: Number((row.inventory_stock_levels as Record<string, unknown>)?.current_quantity ?? 0),
      lastUpdatedAt: (row.inventory_stock_levels as Record<string, unknown>)?.last_updated_at as string ?? '',
    },
  }))
}

export async function findInventoryWithStock(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Array<{ item: InventoryItem; stock: InventoryStockLevel | null }>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, inventory_stock_levels(*)')
    .eq('outlet_id', outletId)
    .eq('status', 'active')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    const stockRows = r.inventory_stock_levels
    const stockRow = Array.isArray(stockRows) ? stockRows[0] : stockRows
    return {
      item: mapItemRow(r),
      stock: stockRow ? mapStockLevelRow(stockRow as Record<string, unknown>) : null,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// Movements
// ═══════════════════════════════════════════════════════════════════

function mapMovementRow(row: Record<string, unknown>): InventoryMovement {
  return {
    id: row.id as number,
    itemId: row.item_id as number,
    outletId: row.outlet_id as string,
    movementType: row.movement_type as InventoryMovement['movementType'],
    quantity: Number(row.quantity ?? 0),
    previousQuantity: Number(row.previous_quantity ?? 0),
    newQuantity: Number(row.new_quantity ?? 0),
    referenceType: (row.reference_type as string) ?? null,
    referenceId: (row.reference_id as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function recordMovement(data: {
  itemId: number
  movementType: string
  quantity: number
  previousQuantity: number
  newQuantity: number
  referenceType?: string | null
  referenceId?: number | null
  notes?: string | null
  createdBy?: string | null
}): Promise<InventoryMovement> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('inventory_movements')
    .insert({
      item_id: data.itemId,
      outlet_id: DEFAULT_OUTLET_ID,
      movement_type: data.movementType,
      quantity: data.quantity,
      previous_quantity: data.previousQuantity,
      new_quantity: data.newQuantity,
      reference_type: data.referenceType ?? null,
      reference_id: data.referenceId ?? null,
      notes: data.notes ?? null,
      created_by: data.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapMovementRow(created)
}

export async function findMovementsByItem(
  itemId: number,
  limit = 50,
): Promise<InventoryMovement[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapMovementRow)
}

// ═══════════════════════════════════════════════════════════════════
// Adjustments
// ═══════════════════════════════════════════════════════════════════

function mapAdjustmentRow(row: Record<string, unknown>): InventoryAdjustment {
  return {
    id: row.id as number,
    itemId: row.item_id as number,
    outletId: row.outlet_id as string,
    previousQuantity: Number(row.previous_quantity ?? 0),
    adjustedQuantity: Number(row.adjusted_quantity ?? 0),
    reason: row.reason as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

export async function recordAdjustment(data: {
  itemId: number
  previousQuantity: number
  adjustedQuantity: number
  reason: string
  createdBy: string
}): Promise<InventoryAdjustment> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('inventory_adjustments')
    .insert({
      item_id: data.itemId,
      outlet_id: DEFAULT_OUTLET_ID,
      previous_quantity: data.previousQuantity,
      adjusted_quantity: data.adjustedQuantity,
      reason: data.reason,
      created_by: data.createdBy,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapAdjustmentRow(created)
}

export async function findAdjustmentsByItem(
  itemId: number,
): Promise<InventoryAdjustment[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapAdjustmentRow)
}
