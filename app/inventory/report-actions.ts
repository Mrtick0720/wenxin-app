'use server'

import { requireRole, requireCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canCountCategory, canManageInventory } from '@/lib/inventory/permissions'
import type { LowStockReportInput } from '@/lib/inventory/types'

const OUTLET_ID = '00000000-0000-0000-0000-000000000001'

export async function createLowStockReportAction(
  input: LowStockReportInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const staff = await requireCurrentStaff()
    const role = staff.role
    const supabase = await createServerSupabaseClient()

    // Fetch item to verify it exists, is active, and get category
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('id, category, status')
      .eq('id', input.itemId)
      .eq('outlet_id', OUTLET_ID)
      .single()

    if (itemError || !item) return { ok: false, error: 'Item not found' }
    if (item.status !== 'active') return { ok: false, error: 'Item is not active' }

    // Server-side permission check: owner/manager can report any; others check category
    if (!canManageInventory(role) && !canCountCategory(role, item.category)) {
      return { ok: false, error: 'You are not permitted to report this item' }
    }

    const { error: insertError } = await supabase
      .from('inventory_low_stock_reports')
      .insert({
        item_id: input.itemId,
        outlet_id: OUTLET_ID,
        reported_by: staff.id,
        report_type: input.reportType,
        urgency: input.urgency,
        note: input.note ?? null,
        suggested_quantity: input.suggestedQuantity ?? null,
        status: 'open',
      })

    if (insertError) return { ok: false, error: insertError.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}

export async function resolveLowStockReportAction(
  reportId: string,
  resolutionNote?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const staff = await requireRole('owner', 'manager')
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('inventory_low_stock_reports')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: staff.id,
        resolution_note: resolutionNote?.trim() ?? null,
      })
      .eq('id', reportId)
      .eq('outlet_id', OUTLET_ID)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorised' }
  }
}
