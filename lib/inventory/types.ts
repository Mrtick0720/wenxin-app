// lib/inventory/types.ts
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

export type LowStockReportType = 'running_low' | 'out_of_stock' | 'needed_tomorrow' | 'unusual_usage' | 'other'
export type LowStockReportUrgency = 'normal' | 'urgent'
export type LowStockReportStatus = 'open' | 'resolved'

export type LowStockReport = {
  id: string
  itemId: number
  outletId: string
  reportedBy: string
  reportType: LowStockReportType
  urgency: LowStockReportUrgency
  note: string | null
  suggestedQuantity: number | null
  status: LowStockReportStatus
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionNote: string | null
}

export type LowStockReportInput = {
  itemId: number
  reportType: LowStockReportType
  urgency: LowStockReportUrgency
  note?: string | null
  suggestedQuantity?: number | null
}

export type InventoryItem = {
  id: number
  outletId: string
  name: string
  category: string
  unit: string
  reorderLevel: number        // min stock / low-stock threshold (col: reorder_level)
  reorderPoint: number | null // sea-freight reorder trigger (col: reorder_point)
  parLevel: number | null     // target/ideal stock level (col: par_level)
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  trackOpened: boolean        // whether to show opened-qty tracking (col: track_opened)
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
  parLevel: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  trackOpened: boolean
  // stock
  currentQuantity: number
  openedQuantity: number
  onOrderQuantity: number
  lastCountedAt: string | null
  lastUpdatedAt: string | null
  // derived
  unopenedQuantity: number
  displayStatus: DisplayStatus
  openReports: LowStockReport[]
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

// Count Sheet types

export type CountItem = {
  id: number
  name: string
  unit: string
  category: string
  currentQuantity: number
  openedQuantity: number
  trackOpened: boolean  // drives Opened input visibility in CountSheet
}

export type CountEntry = {
  item_id: number
  new_quantity: number
  opened_quantity: number  // 0 for non-trackOpened items; RPC uses item's track_opened flag
}

// Item management types

export type ItemCreateData = {
  name: string
  category: string
  unit: string
  trackOpened: boolean
  reorderLevel: number
  reorderPoint: number | null
  parLevel: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  notes: string | null
  initialQuantity: number
  initialOpenedQuantity: number
}

export type ItemUpdateData = {
  name: string
  category: string
  unit: string
  trackOpened: boolean
  reorderLevel: number
  reorderPoint: number | null
  parLevel: number | null
  leadTimeDays: number | null
  location: string | null
  supplier: string | null
  notes: string | null
}
