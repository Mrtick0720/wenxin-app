// ── Assets Repository Layer ──
// Data access for asset operations.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Asset } from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

function mapAssetRow(row: Record<string, unknown>): Asset {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    assetCode: row.asset_code as string,
    name: row.name as string,
    category: row.category as Asset['category'],
    description: (row.description as string) ?? null,
    serialNumber: (row.serial_number as string) ?? null,
    location: (row.location as string) ?? null,
    purchaseDate: (row.purchase_date as string) ?? null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    warrantyExpiry: (row.warranty_expiry as string) ?? null,
    status: row.status as Asset['status'],
    notes: (row.notes as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    disposedAt: (row.disposed_at as string) ?? null,
    disposedBy: (row.disposed_by as string) ?? null,
    disposalReason: (row.disposal_reason as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createAsset(data: {
  assetCode: string
  name: string
  category: string
  description?: string | null
  serialNumber?: string | null
  location?: string | null
  purchaseDate?: string | null
  purchasePrice?: number | null
  warrantyExpiry?: string | null
  notes?: string | null
  createdBy?: string | null
}): Promise<Asset> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('assets')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      asset_code: data.assetCode.trim(),
      name: data.name.trim(),
      category: data.category,
      description: data.description ?? null,
      serial_number: data.serialNumber ?? null,
      location: data.location ?? null,
      purchase_date: data.purchaseDate ?? null,
      purchase_price: data.purchasePrice ?? null,
      warranty_expiry: data.warrantyExpiry ?? null,
      notes: data.notes ?? null,
      created_by: data.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapAssetRow(created)
}

export async function updateAsset(
  assetId: number,
  updates: {
    assetCode?: string
    name?: string
    category?: string
    description?: string | null
    serialNumber?: string | null
    location?: string | null
    purchaseDate?: string | null
    purchasePrice?: number | null
    warrantyExpiry?: string | null
    status?: string
    notes?: string | null
  },
): Promise<Asset> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = {}
  if (updates.assetCode !== undefined) db.asset_code = updates.assetCode
  if (updates.name !== undefined) db.name = updates.name
  if (updates.category !== undefined) db.category = updates.category
  if (updates.description !== undefined) db.description = updates.description
  if (updates.serialNumber !== undefined) db.serial_number = updates.serialNumber
  if (updates.location !== undefined) db.location = updates.location
  if (updates.purchaseDate !== undefined) db.purchase_date = updates.purchaseDate
  if (updates.purchasePrice !== undefined) db.purchase_price = updates.purchasePrice
  if (updates.warrantyExpiry !== undefined) db.warranty_expiry = updates.warrantyExpiry
  if (updates.status !== undefined) db.status = updates.status
  if (updates.notes !== undefined) db.notes = updates.notes

  const { data, error } = await supabase
    .from('assets')
    .update(db)
    .eq('id', assetId)
    .select('*')
    .single()

  if (error) throw error
  return mapAssetRow(data)
}

export async function findAssetById(
  assetId: number,
): Promise<Asset | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  if (error) throw error
  return data ? mapAssetRow(data) : null
}

export async function findAssets(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Asset[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('outlet_id', outletId)
    .order('status', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapAssetRow)
}

export async function findAssetsByStatus(
  status: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Asset[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('status', status)
    .eq('outlet_id', outletId)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapAssetRow)
}

export async function findAssetsByCategory(
  category: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Asset[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('category', category)
    .eq('outlet_id', outletId)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapAssetRow)
}

export async function disposeAsset(
  assetId: number,
  reason: string,
  disposedBy: string,
): Promise<Asset> {
  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('assets')
    .update({
      status: 'disposed',
      disposed_at: now,
      disposed_by: disposedBy,
      disposal_reason: reason.trim(),
    })
    .eq('id', assetId)
    .select('*')
    .single()

  if (error) throw error
  return mapAssetRow(data)
}

export async function findExpiringWarranties(
  daysThreshold = 30,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Asset[]> {
  const supabase = await createServerSupabaseClient()
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + daysThreshold)
  const thresholdStr = threshold.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('status', 'active')
    .not('warranty_expiry', 'is', null)
    .lte('warranty_expiry', thresholdStr)
    .order('warranty_expiry', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapAssetRow)
}
