// ── Suppliers Repository Layer ──
// Data access for supplier operations.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Supplier, SupplierContact } from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Suppliers
// ═══════════════════════════════════════════════════════════════════

function mapSupplierRow(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as number,
    outletId: row.outlet_id as string,
    companyName: row.company_name as string,
    contactPerson: (row.contact_person as string) ?? null,
    phone: (row.phone as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    email: (row.email as string) ?? null,
    address: (row.address as string) ?? null,
    paymentTerms: (row.payment_terms as Supplier['paymentTerms']) ?? null,
    status: row.status as Supplier['status'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createSupplier(data: {
  companyName: string
  contactPerson?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  paymentTerms?: string | null
  notes?: string | null
}): Promise<Supplier> {
  const supabase = await createServerSupabaseClient()
  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({
      outlet_id: DEFAULT_OUTLET_ID,
      company_name: data.companyName.trim(),
      contact_person: data.contactPerson ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      payment_terms: data.paymentTerms ?? null,
      notes: data.notes ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapSupplierRow(created)
}

export async function updateSupplier(
  supplierId: number,
  updates: {
    companyName?: string
    contactPerson?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    address?: string | null
    paymentTerms?: string | null
    status?: string
    notes?: string | null
  },
): Promise<Supplier> {
  const supabase = await createServerSupabaseClient()
  const db: Record<string, unknown> = {}
  if (updates.companyName !== undefined) db.company_name = updates.companyName
  if (updates.contactPerson !== undefined) db.contact_person = updates.contactPerson
  if (updates.phone !== undefined) db.phone = updates.phone
  if (updates.whatsapp !== undefined) db.whatsapp = updates.whatsapp
  if (updates.email !== undefined) db.email = updates.email
  if (updates.address !== undefined) db.address = updates.address
  if (updates.paymentTerms !== undefined) db.payment_terms = updates.paymentTerms
  if (updates.status !== undefined) db.status = updates.status
  if (updates.notes !== undefined) db.notes = updates.notes

  const { data, error } = await supabase
    .from('suppliers')
    .update(db)
    .eq('id', supplierId)
    .select('*')
    .single()

  if (error) throw error
  return mapSupplierRow(data)
}

export async function findSupplierById(
  supplierId: number,
): Promise<Supplier | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .maybeSingle()

  if (error) throw error
  return data ? mapSupplierRow(data) : null
}

export async function findSuppliers(
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Supplier[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('outlet_id', outletId)
    .order('company_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapSupplierRow)
}

export async function findSuppliersByStatus(
  status: string,
  outletId: string = DEFAULT_OUTLET_ID,
): Promise<Supplier[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('status', status)
    .eq('outlet_id', outletId)
    .order('company_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapSupplierRow)
}

// ═══════════════════════════════════════════════════════════════════
// Supplier Contacts
// ═══════════════════════════════════════════════════════════════════

function mapContactRow(row: Record<string, unknown>): SupplierContact {
  return {
    id: row.id as number,
    supplierId: row.supplier_id as number,
    name: row.name as string,
    role: (row.role as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    isPrimary: row.is_primary as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function addContact(data: {
  supplierId: number
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
  isPrimary?: boolean
}): Promise<SupplierContact> {
  const supabase = await createServerSupabaseClient()

  // Unset other primary contacts if this one is primary
  if (data.isPrimary) {
    await supabase
      .from('supplier_contacts')
      .update({ is_primary: false })
      .eq('supplier_id', data.supplierId)
      .eq('is_primary', true)
  }

  const { data: created, error } = await supabase
    .from('supplier_contacts')
    .insert({
      supplier_id: data.supplierId,
      name: data.name.trim(),
      role: data.role ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      is_primary: data.isPrimary ?? false,
    })
    .select('*')
    .single()

  if (error) throw error

  // Update supplier contact_person if primary
  if (data.isPrimary) {
    await supabase
      .from('suppliers')
      .update({ contact_person: data.name.trim() })
      .eq('id', data.supplierId)
  }

  return mapContactRow(created)
}

export async function findContacts(
  supplierId: number,
): Promise<SupplierContact[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('supplier_contacts')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapContactRow)
}

export async function removeContact(contactId: number): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('supplier_contacts')
    .delete()
    .eq('id', contactId)

  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// Purchase History (for supplier detail — read only)
// ═══════════════════════════════════════════════════════════════════

export async function findRecentPurchases(
  supplierId: number,
  limit = 30,
): Promise<Array<Record<string, unknown>>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('purchase_request_items')
    .select('*, purchase_requests!inner(business_date, status)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as Array<Record<string, unknown>>
}
