// ── Inventory Service Layer ──
// Business logic for inventory management.

import {
  createInventoryItem,
  updateInventoryItem,
  findInventoryItemById,
  findInventoryItems,
  getStockLevel,
  updateStockLevel,
  findLowStockItems,
  recordMovement,
  findMovementsByItem,
  recordAdjustment,
} from './repository'
import {
  isValidItemName,
  isValidUnit,
  isValidQuantity,
  isValidReorderLevel,
  isValidMovementType,
  isValidItemStatus,
  isValidAdjustmentReason,
  isLowStock,
  isStockInMovement,
  isStockOutMovement,
} from './validation'
import type {
  InventoryItem,
  InventoryStockLevel,
  InventoryMovement,
  InventoryAdjustment,
} from './types'

// ═══════════════════════════════════════════════════════════════════
// Item Management
// ═══════════════════════════════════════════════════════════════════

export async function createItem(data: {
  name: string
  category: string
  unit: string
  reorderLevel?: number
  notes?: string | null
}): Promise<InventoryItem> {
  if (!isValidItemName(data.name)) throw new Error('Item name is required.')
  if (!isValidUnit(data.unit)) throw new Error('Unit is required.')
  if (data.reorderLevel !== undefined && !isValidReorderLevel(data.reorderLevel)) {
    throw new Error('Reorder level cannot be negative.')
  }
  return createInventoryItem(data)
}

export async function updateItem(
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
  if (updates.name !== undefined && !isValidItemName(updates.name)) {
    throw new Error('Item name cannot be empty.')
  }
  if (updates.unit !== undefined && !isValidUnit(updates.unit)) {
    throw new Error('Unit cannot be empty.')
  }
  if (updates.reorderLevel !== undefined && !isValidReorderLevel(updates.reorderLevel)) {
    throw new Error('Reorder level cannot be negative.')
  }
  if (updates.status !== undefined && !isValidItemStatus(updates.status)) {
    throw new Error(`Invalid status: "${updates.status}".`)
  }
  return updateInventoryItem(itemId, updates)
}

export async function getItem(
  itemId: number,
): Promise<InventoryItem | null> {
  return findInventoryItemById(itemId)
}

export async function getItems(): Promise<InventoryItem[]> {
  return findInventoryItems()
}

// ═══════════════════════════════════════════════════════════════════
// Stock Management
// ═══════════════════════════════════════════════════════════════════

export async function getItemStock(
  itemId: number,
): Promise<InventoryStockLevel | null> {
  return getStockLevel(itemId)
}

export async function getLowStockItems(): Promise<Array<{
  item: InventoryItem
  stock: InventoryStockLevel
}>> {
  return findLowStockItems()
}

// ═══════════════════════════════════════════════════════════════════
// Stock Movement
// ═══════════════════════════════════════════════════════════════════

export async function addMovement(
  itemId: number,
  movementType: string,
  quantity: number,
  staffUserId: string | null,
  reference?: { type?: string | null; id?: number | null },
  notes?: string | null,
): Promise<InventoryMovement> {
  if (!isValidMovementType(movementType)) {
    throw new Error(`Invalid movement type: "${movementType}".`)
  }
  if (!isValidQuantity(quantity)) {
    throw new Error('Quantity cannot be negative.')
  }

  const item = await findInventoryItemById(itemId)
  if (!item) throw new Error('Inventory item not found.')

  const stock = await getStockLevel(itemId)
  const previousQty = stock?.currentQuantity ?? 0

  let newQty: number
  if (isStockInMovement(movementType as never)) {
    newQty = previousQty + quantity
  } else if (isStockOutMovement(movementType as never)) {
    newQty = previousQty - quantity
    if (newQty < 0) {
      throw new Error(`Insufficient stock. Have ${previousQty}, trying to remove ${quantity}.`)
    }
  } else {
    // stock_check — quantity is the verified count
    newQty = quantity
  }

  // Record movement
  const movement = await recordMovement({
    itemId,
    movementType,
    quantity,
    previousQuantity: previousQty,
    newQuantity: newQty,
    referenceType: reference?.type ?? null,
    referenceId: reference?.id ?? null,
    notes,
    createdBy: staffUserId,
  })

  // Update stock level
  await updateStockLevel(itemId, newQty)

  return movement
}

export async function getMovements(
  itemId: number,
  limit?: number,
): Promise<InventoryMovement[]> {
  return findMovementsByItem(itemId, limit)
}

// ═══════════════════════════════════════════════════════════════════
// Stock Adjustment (Manual Correction)
// ═══════════════════════════════════════════════════════════════════

export async function addAdjustment(
  itemId: number,
  adjustedQuantity: number,
  reason: string,
  staffUserId: string,
): Promise<InventoryAdjustment> {
  if (!isValidQuantity(adjustedQuantity)) {
    throw new Error('Adjusted quantity cannot be negative.')
  }
  if (!isValidAdjustmentReason(reason)) {
    throw new Error('A reason is required for stock adjustments.')
  }

  const item = await findInventoryItemById(itemId)
  if (!item) throw new Error('Inventory item not found.')

  const stock = await getStockLevel(itemId)
  const previousQty = stock?.currentQuantity ?? 0

  // Record adjustment
  const adjustment = await recordAdjustment({
    itemId,
    previousQuantity: previousQty,
    adjustedQuantity,
    reason: reason.trim(),
    createdBy: staffUserId,
  })

  // Also record as movement for audit trail
  await recordMovement({
    itemId,
    movementType: 'manual_adjustment',
    quantity: Math.abs(adjustedQuantity - previousQty),
    previousQuantity: previousQty,
    newQuantity: adjustedQuantity,
    notes: `Manual adjustment: ${reason.trim()}`,
    createdBy: staffUserId,
  })

  // Update stock level
  await updateStockLevel(itemId, adjustedQuantity)

  return adjustment
}

// ═══════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  isValidItemName,
  isValidUnit,
  isValidQuantity,
  isValidReorderLevel,
  isValidMovementType,
  isValidItemStatus,
  isValidAdjustmentReason,
  isLowStock,
  isStockInMovement,
  isStockOutMovement,
} from './validation'
