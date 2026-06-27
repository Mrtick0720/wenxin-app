'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { archiveItemAction, deleteItemAction } from './manage-actions'
import type { InventoryView } from '@/lib/inventory/types'
import { canManageInventory, canCountCategory } from '@/lib/inventory/permissions'

type Props = {
  item: InventoryView | undefined
  isOpen: boolean
  role: string
  onClose: () => void
  onReceiveStock: () => void
  onCountStock: () => void
  onEditItem: () => void
  onSaved: () => void
}

export default function ItemActionSheet({
  item,
  isOpen,
  role,
  onClose,
  onReceiveStock,
  onCountStock,
  onEditItem,
  onSaved,
}: Props) {
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setArchiveConfirm(false)
      setArchiving(false)
      setDeleteConfirm(false)
      setDeleting(false)
      setError(null)
      setToast(null)
    }
  }, [isOpen])

  async function handleArchive() {
    if (!item || archiving) return
    setArchiving(true)
    const result = await archiveItemAction(item.id)
    setArchiving(false)
    if (result.ok) {
      setToast('Item archived')
      onSaved()
      setTimeout(() => { setToast(null); onClose() }, 1200)
    } else {
      setError(result.error)
      setArchiveConfirm(false)
    }
  }

  async function handleDelete() {
    if (!item || deleting) return
    setDeleting(true)
    const result = await deleteItemAction(item.id)
    setDeleting(false)
    if (result.ok) {
      setToast('Item deleted')
      onSaved()
      setTimeout(() => { setToast(null); onClose() }, 1200)
    } else {
      setError(result.error)
      setDeleteConfirm(false)
    }
  }

  if (!isOpen || !item) return null

  const canManage = canManageInventory(role)
  const canCount = canCountCategory(role, item.category)

  const lastCounted = item.lastCountedAt
    ? new Date(item.lastCountedAt).toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Never'

  return createPortal(
    <div className="fixed inset-0 z-[500] flex flex-col justify-end">

      {/* Toast */}
      {toast && (
        <div className="fixed top-0 inset-x-0 z-[210] bg-green-500 text-white text-sm font-medium text-center py-3 px-4">
          {toast}
        </div>
      )}

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Item info */}
        <div className="px-5 pt-3 pb-4 border-b border-gray-100">
          <div className="font-semibold text-gray-900 text-base leading-snug">{item.name}</div>
          {item.nameMs && (
            <div className="text-xs text-gray-400 mt-0.5">{item.nameMs}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
              {item.category}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-500">{item.unit}</span>
          </div>
        </div>

        {/* Stock info — read-only */}
        <div className="px-5 py-4 border-b border-gray-100 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Current Stock</div>
            {item.trackOpened ? (
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {item.currentQuantity} {item.unit}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Opened {item.openedQuantity} · Unopened {item.unopenedQuantity}
                </div>
              </div>
            ) : (
              <div className="text-sm font-bold text-gray-900">
                {item.currentQuantity} {item.unit}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Last Counted</div>
            <div className="text-sm font-semibold text-gray-900">{lastCounted}</div>
          </div>
        </div>

        {/* Action rows — daily operations first */}
        <div className="px-5 py-2">

          {canManage && (
            <button
              type="button"
              onClick={onReceiveStock}
              className="w-full flex items-center justify-between py-3.5 text-sm font-medium text-gray-900 border-b border-gray-100"
            >
              <span>Receive Stock</span>
              <span className="text-gray-300 text-base">›</span>
            </button>
          )}

          {canCount && (
            <button
              type="button"
              onClick={onCountStock}
              className="w-full flex items-center justify-between py-3.5 text-sm font-medium text-gray-900 border-b border-gray-100"
            >
              <span>Count Stock</span>
              <span className="text-gray-300 text-base">›</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={onEditItem}
              className="w-full flex items-center justify-between py-3.5 text-sm font-medium text-gray-900 border-b border-gray-100"
            >
              <span>Edit Item</span>
              <span className="text-gray-300 text-base">›</span>
            </button>
          )}

          {/* future: Movement History */}

          {canManage && (
            <>
              {archiveConfirm ? (
                <div className="py-4 space-y-3 border-b border-gray-100">
                  <p className="text-sm text-gray-700 font-medium">Archive this item?</p>
                  <p className="text-xs text-gray-400">Hidden from inventory list. All history preserved.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setArchiveConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={archiving}
                      className="flex-1 py-2.5 rounded-xl text-sm bg-red-500 text-white font-medium disabled:opacity-50"
                    >
                      {archiving ? 'Archiving…' : 'Archive'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setDeleteConfirm(false); setArchiveConfirm(true) }}
                  className="w-full flex items-center py-3.5 text-sm font-medium text-red-400 border-b border-gray-100"
                >
                  Archive Item
                </button>
              )}

              {deleteConfirm ? (
                <div className="py-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">Permanently delete this item?</p>
                  <p className="text-xs text-red-500">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2.5 rounded-xl text-sm bg-red-700 text-white font-medium disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Delete Forever'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setArchiveConfirm(false); setDeleteConfirm(true) }}
                  className="w-full flex items-center py-3.5 text-sm font-medium text-red-700"
                >
                  Delete Item
                </button>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-red-500 py-2 text-center">{error}</p>
          )}
        </div>

        {/* Cancel button */}
        <div
          className="px-5 pt-2 pb-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 active:bg-gray-200"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
