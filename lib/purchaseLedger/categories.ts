// ── Purchase Categories ──
// English is the master language for all categories. Future categories can be
// added here without a database migration (category is stored as free text).
// Legacy values from earlier data (e.g. Condiments/Staples/Supplies) still
// display; they sort after the standard list.

export const PURCHASE_CATEGORIES = [
  'Seafood',
  'Meat',
  'Vegetables',
  'Grocery',
  'Sauces',
  'Beverage',
  'Packaging',
  'Others',
] as const

export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number]

export const DEFAULT_CATEGORY: PurchaseCategory = 'Vegetables'

const CATEGORY_COLOR: Record<string, string> = {
  Seafood: '#3b82f6',
  Meat: '#ef4444',
  Vegetables: '#22c55e',
  Grocery: '#f59e0b',
  Sauces: '#f97316',
  Beverage: '#06b6d4',
  Packaging: '#8b5cf6',
  Others: '#9ca3af',
}

export function categoryColor(category: string): string {
  return CATEGORY_COLOR[category] ?? '#9ca3af'
}

/** Sort index: standard categories in declared order, unknown/legacy last. */
export function categoryOrderIndex(category: string): number {
  const i = (PURCHASE_CATEGORIES as readonly string[]).indexOf(category)
  return i === -1 ? PURCHASE_CATEGORIES.length : i
}

export function sortCategories(categories: string[]): string[] {
  return [...categories].sort(
    (a, b) => categoryOrderIndex(a) - categoryOrderIndex(b),
  )
}
