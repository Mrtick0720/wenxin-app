// ── Inventory Validation ──
// Pure validation functions.

import type { MovementType, InventoryItemStatus } from './types'

export const VALID_MOVEMENT_TYPES: MovementType[] = [
  'purchase_receive', 'manual_adjustment', 'stock_check',
  'waste', 'usage', 'transfer_in', 'transfer_out',
]

export const VALID_ITEM_STATUSES: InventoryItemStatus[] = [
  'active', 'inactive', 'discontinued',
]

export function isValidItemName(name: string): boolean {
  return name.trim().length > 0
}

export function isValidUnit(unit: string): boolean {
  return unit.trim().length > 0
}

export function isValidQuantity(quantity: number): boolean {
  return quantity >= 0
}

export function isValidReorderLevel(level: number): boolean {
  return level >= 0
}

export function isValidMovementType(type: string): boolean {
  return VALID_MOVEMENT_TYPES.includes(type as MovementType)
}

export function isValidItemStatus(status: string): boolean {
  return VALID_ITEM_STATUSES.includes(status as InventoryItemStatus)
}

export function isValidAdjustmentReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length > 0
}

/**
 * Check if current stock is below or at reorder level.
 */
export function isLowStock(currentQuantity: number, reorderLevel: number): boolean {
  return currentQuantity <= reorderLevel
}

/**
 * Movement types that increase stock (add quantity).
 */
export function isStockInMovement(type: MovementType): boolean {
  return ['purchase_receive', 'transfer_in', 'manual_adjustment'].includes(type)
}

/**
 * Movement types that decrease stock (subtract quantity).
 */
export function isStockOutMovement(type: MovementType): boolean {
  return ['waste', 'usage', 'transfer_out'].includes(type)
}
