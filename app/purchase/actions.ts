'use server'

// ── Purchase Ledger Server Actions ──
// All client reads/writes for the ledger go through here so that cost columns
// are never serialized to staff devices. Each action re-checks the role via
// requireRole. Results are wrapped so the client can handle errors gracefully.

import type { StaffRole } from '@/lib/auth/types'
import { requireRole } from '@/lib/auth/currentStaff'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as svc from '@/lib/purchaseLedger/service'
import { computeKpi } from '@/lib/purchaseLedger/kpi'
import {
  canDeletePurchase,
  canEditRecord,
  canExportPurchase,
  canViewPurchaseCosts,
} from '@/lib/purchaseLedger/permissions'
import { businessToday } from '@/lib/purchaseLedger/time'
import type { CatalogItem } from '@/lib/purchaseLedger/catalog'
import type {
  ActionResult,
  PurchaseFilters,
  PurchaseKpi,
  PurchaseRecord,
  PurchaseRecordInput,
  PurchaseSummary,
} from '@/lib/purchaseLedger/types'

export type Perms = { canViewCosts: boolean; canDelete: boolean; canExport: boolean }

export type RecordContext = {
  record: PurchaseRecord
  enteredByName: string | null
  canViewCosts: boolean
  canEdit: boolean
  canDelete: boolean
}

export type PurchaseContext = {
  role: StaffRole
  today: string
  perms: Perms
  records: PurchaseRecord[]
  summary: PurchaseSummary | null
  kpi: PurchaseKpi
}

export type PurchaseHeroContext = {
  role: StaffRole
  today: string
  perms: Perms
  kpi: PurchaseKpi
}

/** Resolve created_by UUIDs → display names via admin (RLS-safe for all roles). */
async function enteredByNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  if (unique.length === 0) return new Map()
  const admin = createAdminSupabaseClient()
  const { data } = await admin
    .from('staff_profiles')
    .select('id, display_name')
    .in('id', unique)
  return new Map((data ?? []).map((r) => [r.id as string, r.display_name as string]))
}

function permsFor(role: StaffRole): Perms {
  return {
    canViewCosts: canViewPurchaseCosts(role),
    canDelete: canDeletePurchase(role),
    canExport: canExportPurchase(role),
  }
}

const ROLES = ['owner', 'manager', 'kitchen'] as const

function fail(error: unknown): ActionResult<never> {
  let message: string
  if (error instanceof Error) {
    message = error.message
  } else if (error != null && typeof error === 'object' && 'message' in error) {
    // Supabase PostgrestError has .message but is not an Error instance
    message = String((error as { message: unknown }).message)
  } else {
    message = String(error)
  }
  console.error('[purchase action]', message, error)
  return { ok: false, error: message }
}

/** Return all active catalog items ordered by seq. Readable by all authenticated staff. */
export async function fetchCatalogAction(): Promise<ActionResult<CatalogItem[]>> {
  try {
    await requireRole(...ROLES)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('purchase_catalog')
      .select('id, name_zh, name_ms, category, unit')
      .eq('active', true)
      .order('seq')
    if (error) throw error
    return { ok: true, data: (data ?? []) as CatalogItem[] }
  } catch (error) {
    return fail(error)
  }
}

/** Bootstrap everything the client needs when rendered via the navigation stack. */
export async function fetchPurchaseContextAction(): Promise<ActionResult<PurchaseContext>> {
  try {
    const staff = await requireRole(...ROLES)
    const [records, summary, kpi] = await Promise.all([
      svc.listRecords(staff.role, {}),
      svc.getSummary(staff.role),
      computeKpi(staff.role),
    ])
    return {
      ok: true,
      data: { role: staff.role, today: businessToday(), perms: permsFor(staff.role), records, summary, kpi },
    }
  } catch (error) {
    return fail(error)
  }
}

/** First bootstrap stage: enough data to render the page shell and hero card. */
export async function fetchPurchaseHeroAction(): Promise<ActionResult<PurchaseHeroContext>> {
  try {
    const staff = await requireRole(...ROLES)
    return {
      ok: true,
      data: {
        role: staff.role,
        today: businessToday(),
        perms: permsFor(staff.role),
        kpi: await computeKpi(staff.role),
      },
    }
  } catch (error) {
    return fail(error)
  }
}

/** Final bootstrap stage: the larger ledger query and its summary. */
export async function fetchPurchaseRecordsAction(): Promise<ActionResult<{
  records: PurchaseRecord[]
  summary: PurchaseSummary | null
}>> {
  try {
    const staff = await requireRole(...ROLES)
    const [records, summary] = await Promise.all([
      svc.listRecords(staff.role, {}),
      svc.getSummary(staff.role),
    ])
    return { ok: true, data: { records, summary } }
  } catch (error) {
    return fail(error)
  }
}

/** Recompute the KPI alone (used after add/edit/delete and on refresh). */
export async function fetchKpiAction(): Promise<ActionResult<PurchaseKpi>> {
  try {
    const staff = await requireRole(...ROLES)
    return { ok: true, data: await computeKpi(staff.role) }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchRecordsAction(
  filters: PurchaseFilters = {},
): Promise<ActionResult<PurchaseRecord[]>> {
  try {
    const staff = await requireRole(...ROLES)
    const data = await svc.listRecords(staff.role, filters)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchPendingVerificationAction(): Promise<ActionResult<PurchaseRecord[]>> {
  try {
    await requireRole(...ROLES)
    const data = await svc.listPendingVerification()
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchSummaryAction(): Promise<ActionResult<PurchaseSummary | null>> {
  try {
    const staff = await requireRole(...ROLES)
    const data = await svc.getSummary(staff.role)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function fetchRecordContextAction(
  id: number,
): Promise<ActionResult<RecordContext>> {
  try {
    const staff = await requireRole(...ROLES)
    const record = await svc.getRecord(staff.role, id)
    if (!record) return { ok: false, error: 'Record not found.' }
    const names = await enteredByNames([record.created_by])
    return {
      ok: true,
      data: {
        record,
        enteredByName: record.created_by ? names.get(record.created_by) ?? null : null,
        canViewCosts: canViewPurchaseCosts(staff.role),
        canDelete: canDeletePurchase(staff.role),
        canEdit: canEditRecord(staff.role, record, staff.id, businessToday()),
      },
    }
  } catch (error) {
    return fail(error)
  }
}

export async function createRecordAction(
  input: PurchaseRecordInput,
): Promise<ActionResult<PurchaseRecord>> {
  try {
    const staff = await requireRole(...ROLES)
    const data = await svc.createRecord(staff.role, staff.id, staff.displayName, input)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function updateRecordAction(
  id: number,
  input: PurchaseRecordInput,
): Promise<ActionResult<PurchaseRecord>> {
  try {
    const staff = await requireRole(...ROLES)
    const data = await svc.updateRecord(staff.role, staff.id, id, input)
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteRecordAction(id: number): Promise<ActionResult<true>> {
  try {
    const staff = await requireRole(...ROLES)
    await svc.deleteRecord(staff.role, id)
    return { ok: true, data: true }
  } catch (error) {
    return fail(error)
  }
}
