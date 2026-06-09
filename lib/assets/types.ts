// ── Assets Domain Types ──

export type AssetStatus = 'active' | 'under_repair' | 'retired' | 'disposed'

export type AssetCategory =
  | 'pos' | 'printer' | 'kitchen_equipment' | 'refrigeration'
  | 'networking' | 'furniture' | 'other'

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired'

export type Asset = {
  id: number
  outletId: string
  assetCode: string
  name: string
  category: AssetCategory
  description: string | null
  serialNumber: string | null
  location: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  warrantyExpiry: string | null
  status: AssetStatus
  notes: string | null
  createdBy: string | null
  disposedAt: string | null
  disposedBy: string | null
  disposalReason: string | null
  createdAt: string
  updatedAt: string
}

export type AssetAction =
  | 'view_assets'
  | 'edit_assets'
  | 'dispose_assets'
