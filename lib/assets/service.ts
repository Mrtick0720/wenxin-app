// ── Assets Service Layer ──
// Business logic for asset management.

import {
  createAsset,
  updateAsset,
  findAssetById,
  findAssets,
  findAssetsByStatus,
  findAssetsByCategory,
  disposeAsset,
  findExpiringWarranties,
} from './repository'
import {
  isValidAssetCode,
  isValidAssetName,
  isValidCategory,
  isValidStatus,
  isValidStatusTransition,
  isTerminalStatus,
  isValidDisposalReason,
  getWarrantyStatus,
} from './validation'
import type { Asset, WarrantyStatus } from './types'

// ═══════════════════════════════════════════════════════════════════
// Create
// ═══════════════════════════════════════════════════════════════════

export async function addAsset(data: {
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
  if (!isValidAssetCode(data.assetCode)) throw new Error('Asset code is required.')
  if (!isValidAssetName(data.name)) throw new Error('Asset name is required.')
  if (!isValidCategory(data.category)) {
    throw new Error(`Invalid category: "${data.category}".`)
  }
  return createAsset(data)
}

// ═══════════════════════════════════════════════════════════════════
// Update
// ═══════════════════════════════════════════════════════════════════

export async function editAsset(
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
    notes?: string | null
  },
): Promise<Asset> {
  const asset = await findAssetById(assetId)
  if (!asset) throw new Error('Asset not found.')

  // Disposed assets cannot be edited
  if (isTerminalStatus(asset.status)) {
    throw new Error('Disposed assets cannot be edited.')
  }

  if (updates.assetCode !== undefined && !isValidAssetCode(updates.assetCode)) {
    throw new Error('Asset code cannot be empty.')
  }
  if (updates.name !== undefined && !isValidAssetName(updates.name)) {
    throw new Error('Asset name cannot be empty.')
  }
  if (updates.category !== undefined && !isValidCategory(updates.category)) {
    throw new Error(`Invalid category: "${updates.category}".`)
  }

  return updateAsset(assetId, updates)
}

// ═══════════════════════════════════════════════════════════════════
// Status Change
// ═══════════════════════════════════════════════════════════════════

export async function changeAssetStatus(
  assetId: number,
  newStatus: string,
): Promise<Asset> {
  if (!isValidStatus(newStatus)) {
    throw new Error(`Invalid status: "${newStatus}".`)
  }

  const asset = await findAssetById(assetId)
  if (!asset) throw new Error('Asset not found.')

  if (isTerminalStatus(asset.status)) {
    throw new Error('Disposed assets cannot be modified.')
  }

  if (!isValidStatusTransition(asset.status, newStatus as never)) {
    throw new Error(`Cannot transition from "${asset.status}" to "${newStatus}".`)
  }

  return updateAsset(assetId, { status: newStatus })
}

// ═══════════════════════════════════════════════════════════════════
// Dispose
// ═══════════════════════════════════════════════════════════════════

export async function disposeAssetWithReason(
  assetId: number,
  reason: string,
  disposedBy: string,
): Promise<Asset> {
  if (!isValidDisposalReason(reason)) {
    throw new Error('A disposal reason is required.')
  }

  const asset = await findAssetById(assetId)
  if (!asset) throw new Error('Asset not found.')

  if (isTerminalStatus(asset.status)) {
    throw new Error('Asset is already disposed.')
  }

  return disposeAsset(assetId, reason, disposedBy)
}

// ═══════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════

export async function getAsset(assetId: number): Promise<Asset | null> {
  return findAssetById(assetId)
}

export async function getAssets(): Promise<Asset[]> {
  return findAssets()
}

export async function getAssetsByStatus(status: string): Promise<Asset[]> {
  if (!isValidStatus(status)) return []
  return findAssetsByStatus(status)
}

export async function getAssetsByCategory(category: string): Promise<Asset[]> {
  return findAssetsByCategory(category)
}

export async function getExpiringWarranties(daysThreshold?: number): Promise<Asset[]> {
  return findExpiringWarranties(daysThreshold)
}

// ═══════════════════════════════════════════════════════════════════
// Warranty Status (Derived)
// ═══════════════════════════════════════════════════════════════════

export function getAssetWarrantyStatus(asset: Asset): {
  expiry: string | null
  status: WarrantyStatus | null
} {
  return {
    expiry: asset.warrantyExpiry,
    status: getWarrantyStatus(asset.warrantyExpiry),
  }
}

// ═══════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  isValidAssetCode,
  isValidAssetName,
  isValidCategory,
  isValidStatus,
  isValidStatusTransition,
  isTerminalStatus,
  isValidDisposalReason,
  getWarrantyStatus,
} from './validation'
