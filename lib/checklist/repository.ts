// ── Checklist Repository Layer ──
// Data access for checklist operations. Abstracts Supabase queries.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  ChecklistTemplate,
  ChecklistTemplateRun,
  ChecklistTemplateItem,
  ChecklistInstance,
  ChecklistItemResponse,
} from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Templates
// ═══════════════════════════════════════════════════════════════════

function mapTemplateRow(row: Record<string, unknown>): ChecklistTemplate {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    name: row.name as string,
    checklistType: row.checklist_type as ChecklistTemplate['checklistType'],
    description: row.description as string,
    assignedRole: row.assigned_role as string,
    isRecurring: row.is_recurring as boolean,
    requiresVerification: row.requires_verification as boolean,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function findTemplates(): Promise<ChecklistTemplate[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapTemplateRow)
}

export async function findTemplateById(
  templateId: number,
): Promise<ChecklistTemplate | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle()

  if (error) throw error
  return data ? mapTemplateRow(data) : null
}

// ═══════════════════════════════════════════════════════════════════
// Template Runs
// ═══════════════════════════════════════════════════════════════════

function mapRunRow(row: Record<string, unknown>): ChecklistTemplateRun {
  return {
    id: row.id as number,
    templateId: row.template_id as number,
    runKey: row.run_key as string,
    scheduledTime: row.scheduled_time as string,
    createdAt: row.created_at as string,
  }
}

export async function findRunsByTemplate(
  templateId: number,
): Promise<ChecklistTemplateRun[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_template_runs')
    .select('*')
    .eq('template_id', templateId)
    .order('scheduled_time', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapRunRow)
}

// ═══════════════════════════════════════════════════════════════════
// Template Items
// ═══════════════════════════════════════════════════════════════════

function mapTemplateItemRow(row: Record<string, unknown>): ChecklistTemplateItem {
  return {
    id: row.id as number,
    templateId: row.template_id as number,
    description: row.description as string,
    category: row.category as string,
    sortOrder: row.sort_order as number,
    isCritical: row.is_critical as boolean,
    requiresNoteOnFail: row.requires_note_on_fail as boolean,
    inventoryRef: (row.inventory_ref as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function findTemplateItems(
  templateId: number,
): Promise<ChecklistTemplateItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapTemplateItemRow)
}

// ═══════════════════════════════════════════════════════════════════
// Instances
// ═══════════════════════════════════════════════════════════════════

function mapInstanceRow(row: Record<string, unknown>): ChecklistInstance {
  return {
    id: row.id as number,
    templateId: row.template_id as number,
    outletId: row.outlet_id as string,
    runKey: row.run_key as string,
    businessDate: row.business_date as string,
    scheduledTime: row.scheduled_time as string,
    status: row.status as ChecklistInstance['status'],
    assignedRole: row.assigned_role as string,
    completedBy: (row.completed_by as string) ?? null,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    verifiedBy: (row.verified_by as string) ?? null,
    verifiedAt: (row.verified_at as string) ?? null,
    verificationNote: (row.verification_note as string) ?? null,
    rejectionNote: (row.rejection_note as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function findInstancesByDate(
  businessDate: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<ChecklistInstance[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_instances')
    .select('*')
    .eq('business_date', businessDate)
    .eq('outlet_id', outletId)
    .order('scheduled_time', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapInstanceRow)
}

export async function findInstanceById(
  instanceId: number,
): Promise<ChecklistInstance | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle()

  if (error) throw error
  return data ? mapInstanceRow(data) : null
}

export async function findInstancesByTemplateAndDate(
  templateId: number,
  businessDate: string,
): Promise<ChecklistInstance[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_instances')
    .select('*')
    .eq('template_id', templateId)
    .eq('business_date', businessDate)
    .order('scheduled_time', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapInstanceRow)
}

// ═══════════════════════════════════════════════════════════════════
// Item Responses
// ═══════════════════════════════════════════════════════════════════

function mapItemResponseRow(row: Record<string, unknown>): ChecklistItemResponse {
  return {
    id: row.id as number,
    instanceId: row.instance_id as number,
    templateItemId: row.template_item_id as number,
    status: row.status as ChecklistItemResponse['status'],
    note: (row.note as string) ?? null,
    respondedBy: (row.responded_by as string) ?? null,
    respondedAt: (row.responded_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function findItemResponses(
  instanceId: number,
): Promise<ChecklistItemResponse[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('checklist_item_responses')
    .select('*')
    .eq('instance_id', instanceId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapItemResponseRow)
}

// ═══════════════════════════════════════════════════════════════════
// Auto-Scheduling
// ═══════════════════════════════════════════════════════════════════

export async function scheduleDailyChecklists(
  businessDate: string,
): Promise<ChecklistInstance[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .rpc('schedule_daily_checklists', { target_date: businessDate })

  if (error) throw error
  return (data ?? []).map(mapInstanceRow)
}
