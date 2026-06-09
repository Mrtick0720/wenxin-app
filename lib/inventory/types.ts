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

export type InventoryItem = {
  id: number
  outletId: string
  name: string
  category: string
  unit: string
  reorderLevel: number
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
  lastUpdatedAt: string
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
