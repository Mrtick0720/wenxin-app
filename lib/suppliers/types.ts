// ── Suppliers Domain Types ──
// V1: supplier directory only. No product catalog, no analytics.

export type SupplierStatus = 'active' | 'inactive' | 'suspended'

export type PaymentTerms = 'cod' | 'net_7' | 'net_14' | 'net_30' | 'net_60'

export type Supplier = {
  id: number
  outletId: string
  companyName: string
  contactPerson: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  paymentTerms: PaymentTerms | null
  status: SupplierStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type SupplierContact = {
  id: number
  supplierId: number
  name: string
  role: string | null
  phone: string | null
  email: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export type SupplierAction =
  | 'view_suppliers'
  | 'edit_suppliers'
  | 'manage_contacts'
