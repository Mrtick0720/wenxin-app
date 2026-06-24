'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { findInventoryWithStock } from '@/lib/inventory/repository'
import { computeDisplayStatus } from '@/lib/inventory/status'
import type { InventoryView } from '@/lib/inventory/types'

export async function fetchInventoryAction(): Promise<
  { ok: true; data: InventoryView[] } | { ok: false; error: string }
> {
  try {
    await requireRole('owner', 'manager', 'kitchen', 'front_desk')
    const rows = await findInventoryWithStock()

    const views: InventoryView[] = rows.map(({ item, stock }) => {
      const currentQuantity = stock?.currentQuantity ?? 0
      const openedQuantity = stock?.openedQuantity ?? 0

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        notes: item.notes,
        reorderLevel: item.reorderLevel,
        reorderPoint: item.reorderPoint,
        parLevel: item.parLevel,
        leadTimeDays: item.leadTimeDays,
        location: item.location,
        supplier: item.supplier,
        trackOpened: item.trackOpened,
        currentQuantity,
        openedQuantity,
        onOrderQuantity: stock?.onOrderQuantity ?? 0,
        lastCountedAt: stock?.lastCountedAt ?? null,
        lastUpdatedAt: stock?.lastUpdatedAt ?? null,
        unopenedQuantity: Math.max(0, currentQuantity - openedQuantity),
        displayStatus: computeDisplayStatus({
          currentQuantity,
          reorderLevel: item.reorderLevel,
          reorderPoint: item.reorderPoint,
          lastCountedAt: stock?.lastCountedAt ?? null,
          category: item.category,
        }),
      }
    })

    return { ok: true, data: views }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
