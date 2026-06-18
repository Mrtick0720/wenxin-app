'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StaffRole } from '@/lib/auth/types'
import {
  getStaffAccountActionKeys,
  type StaffAccountStatus,
} from '@/lib/staffAccountActions'
import {
  archiveStaffAction,
  changeStaffRoleAction,
  createStaffAction,
  forceLogoutStaffAction,
  reactivateStaffAction,
  resetStaffPasswordAction,
  restoreStaffAction,
  suspendStaffAction,
  type AccountActionState,
} from './actions'

export type StaffAccountRow = {
  id: string
  staff_id: string
  display_name: string
  role: StaffRole
  active: boolean
  archived: boolean
  archive_date: string | null
  archive_reason: string | null
  last_login_at: string | null
  session_active: boolean
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'archived'

const ARCHIVE_REASONS = ['Resigned', 'Terminated', 'No Longer Employed', 'Other']

const initialState: AccountActionState = { error: '', success: '' }

const ROLE_ORDER: StaffRole[] = [
  'owner', 'manager', 'kitchen', 'front_desk', 'cashier', 'packing', 'delivery', 'other',
]

const ALL_ROLES: Array<{ value: StaffRole; label: string }> = [
  { value: 'owner',      label: 'Owner' },
  { value: 'manager',    label: 'Manager' },
  { value: 'kitchen',    label: 'Kitchen' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'cashier',    label: 'Cashier' },
  { value: 'packing',    label: 'Packing' },
  { value: 'delivery',   label: 'Delivery' },
  { value: 'other',      label: 'Other' },
]

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuching',
  }).format(new Date(value))
}

// Explicit boolean checks — avoids truthy coercion on WebKit
function getStatus(account: StaffAccountRow): StaffAccountStatus {
  if (account.archived === true) return 'archived'
  if (account.active === false) return 'suspended'
  return 'active'
}

function sortAccounts(accounts: StaffAccountRow[], ownerId: string): StaffAccountRow[] {
  return [...accounts].sort((a, b) => {
    if (a.id === ownerId) return -1
    if (b.id === ownerId) return 1
    const aRole = ROLE_ORDER.indexOf(a.role)
    const bRole = ROLE_ORDER.indexOf(b.role)
    if (aRole !== bRole) return aRole - bRole
    const aActive = a.active === true && a.archived !== true ? 0 : 1
    const bActive = b.active === true && b.archived !== true ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return a.display_name.localeCompare(b.display_name)
  })
}

function StatusBadge({ status }: { status: StaffAccountStatus }) {
  const styles = {
    active:    'bg-green-50 text-green-600',
    suspended: 'bg-red-50 text-red-600',
    archived:  'bg-gray-100 text-gray-500',
  }
  const labels = { active: 'Active', suspended: 'Suspended', archived: 'Archived' }
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

const SHEET_STYLE: React.CSSProperties = {
  bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
  maxHeight: 'calc(85vh - 64px)',
}

export default function StaffAccountsClient({
  accounts,
  ownerId,
}: {
  accounts: StaffAccountRow[]
  ownerId: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [detailTarget, setDetailTarget] = useState<StaffAccountRow | null>(null)
  const [resetTarget, setResetTarget] = useState<StaffAccountRow | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<StaffAccountRow | null>(null)

  const [createState, createAction, createPending] = useActionState(createStaffAction, initialState)
  const [resetState, resetAction, resetPending] = useActionState(resetStaffPasswordAction, initialState)
  const [archiveState, archiveAction, archivePending] = useActionState(archiveStaffAction, initialState)
  // Single useActionState at top level — avoids sub-component hook issues on Safari
  const [roleState, roleAction, rolePending] = useActionState(changeStaffRoleAction, initialState)
  const [roleTargetId, setRoleTargetId] = useState<string | null>(null)
  // Optimistic local role values — updated immediately so dropdown reflects new role before server refresh
  const [localRoles, setLocalRoles] = useState<Record<string, StaffRole>>(() =>
    Object.fromEntries(accounts.map(a => [a.id, a.role]))
  )

  // Refresh server data immediately when role change succeeds
  useEffect(() => {
    if (roleState.success) router.refresh()
  }, [roleState.success, router])

  // Sync detailTarget with refreshed account data
  useEffect(() => {
    if (detailTarget) {
      const updated = accounts.find(a => a.id === detailTarget.id)
      if (updated) setDetailTarget(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  const sorted = useMemo(() => sortAccounts(accounts, ownerId), [accounts, ownerId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter(account => {
      if (q && !account.display_name.toLowerCase().includes(q) && !account.staff_id.toLowerCase().includes(q)) return false
      if (roleFilter !== 'all' && account.role !== roleFilter) return false
      const s = getStatus(account)
      if (statusFilter !== 'all' && s !== statusFilter) return false
      return true
    })
  }, [sorted, query, roleFilter, statusFilter])

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'archived', label: 'Archived' },
  ]

  // Detail sheet action keys
  const detailActionKeys = detailTarget
    ? getStaffAccountActionKeys({
        isOwner: detailTarget.id === ownerId,
        status: getStatus(detailTarget),
        sessionActive: detailTarget.session_active,
      })
    : []

  return (
    <>
      {/* Status filter tabs */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 mb-3">
        {statusTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              statusFilter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + role filter + create */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search staff"
          className="h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-orange-500"
        />
        <select
          value={roleFilter}
          onChange={event => setRoleFilter(event.target.value)}
          className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
        >
          <option value="all">All roles</option>
          {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-11 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white active:bg-orange-600"
        >
          Create
        </button>
      </div>

      {/* ── Account list ── */}
      <div className="mt-4 space-y-2">
        {filtered.map(account => {
          const isOwner = account.id === ownerId
          const status = getStatus(account)
          const isActive = status === 'active'
          const isArchived = status === 'archived'

          const roleDirty = (localRoles[account.id] ?? account.role) !== account.role

          return (
            <article key={account.id} className="rounded-xl border border-gray-100 bg-white px-4 py-2.5">

              {/* Row 1: Name | role selector | save | status */}
              {isOwner || isArchived ? (
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 truncate text-sm font-semibold text-gray-900">{account.display_name}</h2>
                  <span className="text-xs text-gray-400 capitalize">{account.role.replace('_', ' ')}</span>
                  <StatusBadge status={status} />
                </div>
              ) : (
                <form
                  action={roleAction}
                  className="flex items-center gap-1.5"
                  onSubmit={event => {
                    const select = (event.currentTarget as HTMLFormElement).elements.namedItem('role') as HTMLSelectElement
                    const newRole = select?.value as StaffRole
                    setRoleTargetId(account.id)
                    if (newRole) setLocalRoles(prev => ({ ...prev, [account.id]: newRole }))
                  }}
                >
                  <input type="hidden" name="targetId" value={account.id} />
                  <h2 className="shrink-0 text-sm font-semibold text-gray-900">{account.display_name}</h2>
                  {isActive && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${account.session_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      aria-label={account.session_active ? 'Online' : 'Offline'}
                    />
                  )}
                  <select
                    name="role"
                    value={localRoles[account.id] ?? account.role}
                    onChange={event => setLocalRoles(prev => ({ ...prev, [account.id]: event.target.value as StaffRole }))}
                    className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-700"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {roleDirty && (
                    <button
                      type="submit"
                      disabled={rolePending && roleTargetId === account.id}
                      className="h-7 shrink-0 rounded-md bg-orange-500 px-2.5 text-xs font-semibold text-white disabled:opacity-50 active:bg-orange-600"
                    >
                      {rolePending && roleTargetId === account.id ? '…' : 'Save'}
                    </button>
                  )}
                  <StatusBadge status={status} />
                </form>
              )}

              {/* Row 2: Last login | Edit */}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {account.last_login_at ? formatDate(account.last_login_at) : 'Never logged in'}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailTarget(account)}
                  className="text-xs font-medium text-gray-400 active:text-gray-600"
                >
                  Edit ›
                </button>
              </div>

              {roleTargetId === account.id && roleState.error && (
                <p className="mt-1 text-xs text-red-500">{roleState.error}</p>
              )}

            </article>
          )
        })}
      </div>

      {/* ── Create sheet ── */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="fixed left-0 right-0 z-[201] rounded-t-2xl bg-white flex flex-col" style={SHEET_STYLE}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Create staff account</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 w-8 flex items-center justify-center text-gray-400 text-xl" aria-label="Close">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {createState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{createState.error}</p>}
              {createState.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{createState.success}</p>}
              <input name="displayName" form="create-form" required placeholder="Display name" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <input name="staffId" form="create-form" required autoCapitalize="none" placeholder="Staff ID" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <select name="role" form="create-form" required defaultValue="front_desk" className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input name="password" form="create-form" type="password" minLength={8} required placeholder="Temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
            </div>
            <form id="create-form" action={createAction} className="flex-shrink-0">
              <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={createPending} className="flex-1 h-11 rounded-xl bg-orange-500 text-sm font-semibold text-white disabled:opacity-60">
                  {createPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Staff detail sheet ── */}
      {detailTarget && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/40" onClick={() => setDetailTarget(null)} />
          <div className="fixed left-0 right-0 z-[201] rounded-t-2xl bg-white flex flex-col" style={SHEET_STYLE}>

            {/* Sheet header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{detailTarget.display_name}</h2>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-sm text-gray-400">{detailTarget.staff_id}</span>
                  <StatusBadge status={getStatus(detailTarget)} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="h-8 w-8 flex items-center justify-center text-gray-400 text-xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">

              {/* Info section */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Last login</span>
                  <span className="font-medium text-gray-700">{formatDate(detailTarget.last_login_at)}</span>
                </div>
                {getStatus(detailTarget) === 'archived' && detailTarget.archive_date && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Archived</span>
                      <span className="font-medium text-gray-700">{formatDate(detailTarget.archive_date)}</span>
                    </div>
                    {detailTarget.archive_reason && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Reason</span>
                        <span className="font-medium text-gray-700">{detailTarget.archive_reason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions section */}
              {detailActionKeys.length > 0 && (
                <div className="px-5 py-4 space-y-2">
                  {detailActionKeys.includes('reset-password') && (
                    <button
                      type="button"
                      onClick={() => setResetTarget(detailTarget)}
                      className="w-full rounded-xl bg-gray-100 px-4 py-3 text-left text-sm font-medium text-gray-700 active:bg-gray-200"
                    >
                      Reset password
                    </button>
                  )}
                  {detailActionKeys.includes('force-logout') && (
                    <form
                      action={forceLogoutStaffAction}
                      onSubmit={event => {
                        if (!window.confirm(`Force ${detailTarget.display_name} to sign out?`)) event.preventDefault()
                        else setDetailTarget(null)
                      }}
                    >
                      <input type="hidden" name="targetId" value={detailTarget.id} />
                      <button type="submit" className="w-full rounded-xl bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-700 active:bg-amber-100">
                        Force logout
                      </button>
                    </form>
                  )}
                  {detailActionKeys.includes('reactivate') && (
                    <form
                      action={reactivateStaffAction}
                      onSubmit={event => {
                        if (!window.confirm(`Reactivate ${detailTarget.display_name}?`)) event.preventDefault()
                        else setDetailTarget(null)
                      }}
                    >
                      <input type="hidden" name="targetId" value={detailTarget.id} />
                      <button type="submit" className="w-full rounded-xl bg-green-50 px-4 py-3 text-left text-sm font-medium text-green-600 active:bg-green-100">
                        Reactivate
                      </button>
                    </form>
                  )}
                  {detailActionKeys.includes('suspend') && (
                    <form
                      action={suspendStaffAction}
                      onSubmit={event => {
                        if (!window.confirm(`Suspend ${detailTarget.display_name}?`)) event.preventDefault()
                        else setDetailTarget(null)
                      }}
                    >
                      <input type="hidden" name="targetId" value={detailTarget.id} />
                      <button type="submit" className="w-full rounded-xl bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-600 active:bg-red-100">
                        Suspend
                      </button>
                    </form>
                  )}
                  {detailActionKeys.includes('restore') && (
                    <form
                      action={restoreStaffAction}
                      onSubmit={event => {
                        if (!window.confirm(`Restore ${detailTarget.display_name} to active?`)) event.preventDefault()
                        else setDetailTarget(null)
                      }}
                    >
                      <input type="hidden" name="targetId" value={detailTarget.id} />
                      <button type="submit" className="w-full rounded-xl bg-green-50 px-4 py-3 text-left text-sm font-medium text-green-600 active:bg-green-100">
                        Restore
                      </button>
                    </form>
                  )}
                  {detailActionKeys.includes('archive') && (
                    <button
                      type="button"
                      onClick={() => setArchiveTarget(detailTarget)}
                      className="w-full rounded-xl bg-gray-800 px-4 py-3 text-left text-sm font-medium text-white active:bg-gray-700"
                    >
                      Archive
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Reset password sub-sheet (z-[202] layers above detail sheet) ── */}
      {resetTarget && (
        <>
          <div className="fixed inset-0 z-[202] bg-black/40" onClick={() => setResetTarget(null)} />
          <div className="fixed left-0 right-0 z-[203] rounded-t-2xl bg-white flex flex-col" style={SHEET_STYLE}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Reset password</h2>
                <p className="text-xs text-gray-400 mt-0.5">{resetTarget.display_name}</p>
              </div>
              <button type="button" onClick={() => setResetTarget(null)} className="h-8 w-8 flex items-center justify-center text-gray-400 text-xl" aria-label="Close">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {resetState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{resetState.error}</p>}
              {resetState.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{resetState.success}</p>}
              <input name="password" form="reset-form" type="password" minLength={8} required placeholder="New temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <input name="confirmation" form="reset-form" type="password" minLength={8} required placeholder="Confirm temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
            </div>
            <form id="reset-form" action={resetAction} className="flex-shrink-0">
              <input type="hidden" name="targetId" value={resetTarget.id} />
              <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setResetTarget(null)} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={resetPending} className="flex-1 h-11 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-60">
                  {resetPending ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Archive sub-sheet (z-[202] layers above detail sheet) ── */}
      {archiveTarget && (
        <>
          <div className="fixed inset-0 z-[202] bg-black/40" onClick={() => setArchiveTarget(null)} />
          <div className="fixed left-0 right-0 z-[203] rounded-t-2xl bg-white flex flex-col" style={SHEET_STYLE}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Archive Employee?</h2>
                <p className="text-xs text-gray-400 mt-0.5">{archiveTarget.display_name}</p>
              </div>
              <button type="button" onClick={() => setArchiveTarget(null)} className="h-8 w-8 flex items-center justify-center text-gray-400 text-xl" aria-label="Close">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-1.5">
                <p className="font-medium text-gray-700">This employee will:</p>
                <p>• lose login access</p>
                <p>• be removed from active schedules</p>
                <p>• be hidden from active staff lists</p>
                <p>• remain available in historical records</p>
              </div>
              {archiveState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{archiveState.error}</p>}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Reason</label>
                <select name="reason" form="archive-form" required defaultValue="" className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-orange-500 outline-none">
                  <option value="" disabled>Select a reason</option>
                  {ARCHIVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <form id="archive-form" action={archiveAction} className="flex-shrink-0">
              <input type="hidden" name="targetId" value={archiveTarget.id} />
              <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setArchiveTarget(null)} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={archivePending} className="flex-1 h-11 rounded-xl bg-gray-800 text-sm font-semibold text-white disabled:opacity-60">
                  {archivePending ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  )
}
