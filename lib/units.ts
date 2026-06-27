/**
 * Single source of truth for purchase and inventory units across the entire app.
 *
 * Add new units here. Every module that selects a unit
 * (Purchase, Purchase Checklist, Inventory, Add/Edit Item) imports from here.
 *
 * Business rules:
 *   - Sub-1 kg quantities use decimal kg (e.g. 0.5 kg), not g
 *   - Sub-1 L quantities use decimal L (e.g. 0.5 L), not ml
 */
export const PURCHASE_UNITS: string[] = [
  // Weight / Volume
  'kg',
  'L',
  // Each / count
  'pcs',
  'bunch',
  'portion',
  // Soft packaging
  'bag',
  'pack',
  // Rigid containers
  'bottle',
  'can',
  'jar',
  'tub',
  'bucket',
  'box',
  'carton',
  'tray',
  'roll',
]
