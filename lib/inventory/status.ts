import type { DisplayStatus } from './types'

export const INVENTORY_CATEGORIES = [
  'Fresh',
  'Sauces',
  'Dry Goods',
  'Drinks',
  'Packaging',
  'Supplies',
] as const

export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]

export const NEED_COUNT_DAYS: Record<string, number> = {
  Fresh: 3,
  Drinks: 7,
  Sauces: 14,
  'Dry Goods': 14,
  Packaging: 14,
  Supplies: 14,
}

export function computeDisplayStatus(item: {
  currentQuantity: number
  reorderLevel: number
  reorderPoint: number | null
  lastCountedAt: string | null
  category: string
}): DisplayStatus {
  const qty = item.currentQuantity

  if (qty === 0) return 'out'
  if (qty <= item.reorderLevel) return 'low'
  if (item.reorderPoint != null && qty <= item.reorderPoint) return 'need_reorder'

  const threshold = NEED_COUNT_DAYS[item.category] ?? 14
  const cutoff = Date.now() - threshold * 86_400_000
  if (!item.lastCountedAt || new Date(item.lastCountedAt).getTime() < cutoff) return 'need_count'

  return 'ok'
}
