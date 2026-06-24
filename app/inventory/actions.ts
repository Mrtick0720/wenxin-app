'use server'

import { requireRole } from '@/lib/auth/currentStaff'
import { findInventoryWithStock } from '@/lib/inventory/repository'
import { computeDisplayStatus } from '@/lib/inventory/status'
import type { InventoryView, LowStockReport, LowStockReportType, LowStockReportUrgency, LowStockReportStatus } from '@/lib/inventory/types'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function fetchInventoryAction(): Promise<
  { ok: true; data: InventoryView[] } | { ok: false; error: string }
> {
  try {
    await requireRole('owner', 'manager', 'kitchen', 'front_desk')
    const rows = await findInventoryWithStock()

    const supabase = await createServerSupabaseClient()
    const { data: reportRows } = await supabase
      .from('inventory_low_stock_reports')
      .select('id, item_id, outlet_id, reported_by, report_type, urgency, note, suggested_quantity, status, created_at, resolved_at, resolved_by, resolution_note')
      .eq('outlet_id', OUTLET_ID)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    const reportsByItemId = new Map<number, LowStockReport[]>()
    for (const row of reportRows ?? []) {
      const report: LowStockReport = {
        id: row.id,
        itemId: row.item_id,
        outletId: row.outlet_id,
        reportedBy: row.reported_by,
        reportType: row.report_type as LowStockReportType,
        urgency: row.urgency as LowStockReportUrgency,
        note: row.note ?? null,
        suggestedQuantity: row.suggested_quantity != null ? Number(row.suggested_quantity) : null,
        status: row.status as LowStockReportStatus,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at ?? null,
        resolvedBy: row.resolved_by ?? null,
        resolutionNote: row.resolution_note ?? null,
      }
      const existing = reportsByItemId.get(row.item_id) ?? []
      existing.push(report)
      reportsByItemId.set(row.item_id, existing)
    }

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
        openReports: reportsByItemId.get(item.id) ?? [],
      }
    })

    return { ok: true, data: views }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
