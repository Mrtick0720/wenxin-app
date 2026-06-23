// ── Inventory Domain Types ──

export type InventoryItemStatus = 'active' | 'inactive' | 'discontinued'

export type MovementType =
  | 'purchase_receive'
  | 'manual_adjustment'
  | 'stock_check'
  | 'waste'
  | 'usage'
  | 'transfer_in'
  | 'transfer_out'

export type DisplayStatus = 'out' | 'low' | 'need_reorder' | 'need_count' | 'ok'

export type InventoryItem = {
  id: number
  outletId: string
  name: string
  category: string
  unit: string
  reorderLevel: number        // = min stock / dangerous threshold (existing col: reorder_level)
  reorderPoint: number | null // = sea-freight reorder trigger (new col: reorder_point)
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  status: InventoryItemStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type InventoryStockLevel = {
  id: number
  itemId: number
  outletId: string
  currentQuantity: number
  openedQuantity: number
  onOrderQuantity: number
  lastCountedAt: string | null
  lastUpdatedAt: string
}

// Flat joined view used by the Inventory page — one object per item
export type InventoryView = {
  id: number
  name: string
  category: string
  unit: string
  notes: string | null
  // item config
  reorderLevel: number
  reorderPoint: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  // stock
  currentQuantity: number
  openedQuantity: number
  onOrderQuantity: number
  lastCountedAt: string | null
  lastUpdatedAt: string | null
  // derived
  unopenedQuantity: number  // = currentQuantity - openedQuantity
  displayStatus: DisplayStatus
}

export type InventoryMovement = {
  id: number
  itemId: number
  outletId: string
  movementType: MovementType
  quantity: number
  previousQuantity: number
  newQuantity: number
  referenceType: string | null
  referenceId: number | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export type InventoryAdjustment = {
  id: number
  itemId: number
  outletId: string
  previousQuantity: number
  adjustedQuantity: number
  reason: string
  createdBy: string
  createdAt: string
}

export type InventoryAction =
  | 'view_items'
  | 'edit_items'
  | 'record_movement'
  | 'record_adjustment'
