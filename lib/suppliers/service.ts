// ── Suppliers Service Layer ──
// Business logic for supplier management.

import {
  createSupplier,
  updateSupplier,
  findSupplierById,
  findSuppliers,
  findSuppliersByStatus,
  addContact,
  findContacts,
  removeContact,
} from './repository'
import {
  isValidCompanyName,
  isValidStatus,
  isValidPaymentTerms,
  isValidStatusTransition,
  isValidContactName,
} from './validation'
import type { Supplier, SupplierContact } from './types'

// ═══════════════════════════════════════════════════════════════════
// Supplier CRUD
// ═══════════════════════════════════════════════════════════════════

export async function addSupplier(data: {
  companyName: string
  contactPerson?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  paymentTerms?: string | null
  notes?: string | null
}): Promise<Supplier> {
  if (!isValidCompanyName(data.companyName)) {
    throw new Error('Company name is required.')
  }
  if (!isValidPaymentTerms(data.paymentTerms)) {
    throw new Error(`Invalid payment terms: "${data.paymentTerms}".`)
  }
  return createSupplier(data)
}

export async function editSupplier(
  supplierId: number,
  updates: {
    companyName?: string
    contactPerson?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    address?: string | null
    paymentTerms?: string | null
    notes?: string | null
  },
): Promise<Supplier> {
  if (updates.companyName !== undefined && !isValidCompanyName(updates.companyName)) {
    throw new Error('Company name cannot be empty.')
  }
  if (updates.paymentTerms !== undefined && !isValidPaymentTerms(updates.paymentTerms)) {
    throw new Error(`Invalid payment terms: "${updates.paymentTerms}".`)
  }
  return updateSupplier(supplierId, updates)
}

export async function changeSupplierStatus(
  supplierId: number,
  newStatus: string,
): Promise<Supplier> {
  if (!isValidStatus(newStatus)) {
    throw new Error(`Invalid status: "${newStatus}".`)
  }

  const supplier = await findSupplierById(supplierId)
  if (!supplier) throw new Error('Supplier not found.')

  if (!isValidStatusTransition(supplier.status, newStatus as never)) {
    throw new Error(`Cannot transition from "${supplier.status}" to "${newStatus}".`)
  }

  return updateSupplier(supplierId, { status: newStatus })
}

// ═══════════════════════════════════════════════════════════════════
// Supplier Queries
// ═══════════════════════════════════════════════════════════════════

export async function getSupplier(
  supplierId: number,
): Promise<Supplier | null> {
  return findSupplierById(supplierId)
}

export async function getSuppliers(): Promise<Supplier[]> {
  return findSuppliers()
}

export async function getActiveSuppliers(): Promise<Supplier[]> {
  return findSuppliersByStatus('active')
}

export async function getSuppliersByStatus(status: string): Promise<Supplier[]> {
  if (!isValidStatus(status)) return []
  return findSuppliersByStatus(status)
}

// ═══════════════════════════════════════════════════════════════════
// Contact Management
// ═══════════════════════════════════════════════════════════════════

export async function addSupplierContact(data: {
  supplierId: number
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
  isPrimary?: boolean
}): Promise<SupplierContact> {
  if (!isValidContactName(data.name)) {
    throw new Error('Contact name is required.')
  }
  return addContact(data)
}

export async function getSupplierContacts(
  supplierId: number,
): Promise<SupplierContact[]> {
  return findContacts(supplierId)
}

export async function removeSupplierContact(
  contactId: number,
): Promise<void> {
  return removeContact(contactId)
}

// ═══════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  isValidCompanyName,
  isValidStatus,
  isValidPaymentTerms,
  isValidStatusTransition,
  isValidContactName,
} from './validation'
