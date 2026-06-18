'use client'

import { useActionState, useState } from 'react'
import BackButton from '@/app/components/BackButton'
import type { StaffAccountRow } from './StaffAccountsClient'
import { getStaffAccountActionKeys } from '@/lib/staffAccountActions'
import {
  archiveStaffAction,
  forceLogoutStaffAction,
  reactivateStaffAction,
  resetStaffPasswordAction,
  restoreStaffAction,
  suspendStaffAction,
  updateStaffInfoAction,
  type AccountActionState,
} from './actions'

const ARCHIVE_REASONS = ['Resigned', 'Terminated', 'No Longer Employed', 'Other']

const initialState: AccountActionState = { error: '', success: '' }

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuching',
  }).format(new Date(value))
}

function formatJoinDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kuching',
  }).format(new Date(value))
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="shrink-0 text-base text-gray-400 w-28">{label}</span>
      <span className="flex-1 text-base font-medium text-gray-800 text-right">{value}</span>
    </div>
  )
}

export default function StaffDetailPage({
  account,
  ownerId,
}: {
  account: StaffAccountRow
  ownerId: string
}) {
  const isOwner = account.id === ownerId
  const status = account.archived === true ? 'archived' : account.active === false ? 'suspended' : 'active'
  const actionKeys = getStaffAccountActionKeys({ isOwner, status, sessionActive: account.session_active })

  // Editable info state
  const [phone, setPhone]     = useState(account.phone ?? '')
  const [address, setAddress] = useState(account.address ?? '')
  const [notes, setNotes]     = useState(account.notes ?? '')

  const [infoState, infoAction, infoPending] = useActionState(updateStaffInfoAction, initialState)
  const [resetState, resetAction, resetPending] = useActionState(resetStaffPasswordAction, initialState)
  const [archiveState, archiveAction, archivePending] = useActionState(archiveStaffAction, initialState)

  const [showReset, setShowReset]     = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const statusLabel  = status === 'active' ? 'Active' : status === 'suspended' ? 'Suspended' : 'Archived'
  const statusColor  = status === 'active' ? 'text-green-600' : status === 'suspended' ? 'text-red-600' : 'text-gray-500'
  const roleLabel    = account.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

  const SHEET_STYLE: React.CSSProperties = {
    bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
    maxHeight: 'calc(85vh - 64px)',
  }

  return (
    <main className="page-slide-in min-h-dvh bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/staff/accounts" />
        <h1 className="flex-1 truncate text-base font-semibold text-gray-900">{account.display_name}</h1>
        <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
      </header>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* ── Basic Information ── */}
        <section className="mx-4 mt-4 rounded-xl bg-white overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Basic Information</h2>
          </div>
          <form action={infoAction} id="info-form">
            <input type="hidden" name="targetId" value={account.id} />
            <div className="px-4">
              <Row label="Name"     value={account.display_name} />
              <Row label="Username" value={account.staff_id} />

              {/* Phone — editable */}
              <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100">
                <span className="shrink-0 text-base text-gray-400 w-28">Phone</span>
                <input
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="—"
                  className="flex-1 text-base font-medium text-gray-800 text-right outline-none bg-transparent placeholder:text-gray-300"
                />
              </div>

              {/* Address — editable */}
              <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100">
                <span className="shrink-0 text-base text-gray-400 w-28">Address</span>
                <input
                  name="address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="—"
                  className="flex-1 text-base font-medium text-gray-800 text-right outline-none bg-transparent placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Notes — multi-line */}
            <div className="px-4 pb-3 pt-1">
              <label className="text-sm text-gray-400 mb-1.5 block">Notes</label>
              <textarea
                name="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Part-time, can work morning shift only, speaks Chinese…"
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-800 outline-none focus:border-orange-400 resize-none placeholder:text-gray-300"
              />
            </div>

            {infoState.error   && <p className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{infoState.error}</p>}
            {infoState.success && <p className="mx-4 mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{infoState.success}</p>}

            {!isOwner && (
              <div className="px-4 pb-4">
                <button
                  type="submit"
                  form="info-form"
                  disabled={infoPending}
                  className="h-10 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white disabled:opacity-60 active:bg-orange-600"
                >
                  {infoPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </form>
        </section>

        {/* ── Employment Information ── */}
        <section className="mx-4 mt-3 rounded-xl bg-white overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Employment</h2>
          </div>
          <div className="px-4 pb-3">
            <Row label="Role"      value={roleLabel} />
            <Row label="Status"    value={<span className={statusColor}>{statusLabel}</span>} />
            <Row label="Join Date" value={formatJoinDate(account.created_at)} />
            {status === 'archived' && account.archive_date && (
              <>
                <Row label="Archived"  value={formatDate(account.archive_date)} />
                {account.archive_reason && <Row label="Reason" value={account.archive_reason} />}
              </>
            )}
          </div>
        </section>

        {/* ── System Information ── */}
        <section className="mx-4 mt-3 rounded-xl bg-white overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">System</h2>
          </div>
          <div className="px-4 pb-3">
            <Row label="Last Login" value={formatDate(account.last_login_at)} />
          </div>
        </section>

        {/* ── Account Actions ── */}
        {actionKeys.length > 0 && (
          <section className="mx-4 mt-3 mb-4 rounded-xl bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Account Actions</h2>
            </div>
            <div className="px-4 pb-4 space-y-2">

              {/* Neutral actions */}
              {actionKeys.includes('reset-password') && (
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="w-full rounded-xl bg-gray-100 px-4 py-3 text-left text-sm font-medium text-gray-700 active:bg-gray-200"
                >
                  Reset password
                </button>
              )}
              {actionKeys.includes('force-logout') && (
                <form action={forceLogoutStaffAction} onSubmit={e => { if (!window.confirm(`Force ${account.display_name} to sign out?`)) e.preventDefault() }}>
                  <input type="hidden" name="targetId" value={account.id} />
                  <button type="submit" className="w-full rounded-xl bg-gray-100 px-4 py-3 text-left text-sm font-medium text-gray-700 active:bg-gray-200">
                    Force logout
                  </button>
                </form>
              )}
              {actionKeys.includes('restore') && (
                <form action={restoreStaffAction} onSubmit={e => { if (!window.confirm(`Restore ${account.display_name} to active?`)) e.preventDefault() }}>
                  <input type="hidden" name="targetId" value={account.id} />
                  <button type="submit" className="w-full rounded-xl bg-green-50 px-4 py-3 text-left text-sm font-medium text-green-600 active:bg-green-100">
                    Restore account
                  </button>
                </form>
              )}

              {/* Warning */}
              {actionKeys.includes('reactivate') && (
                <form action={reactivateStaffAction} onSubmit={e => { if (!window.confirm(`Reactivate ${account.display_name}?`)) e.preventDefault() }}>
                  <input type="hidden" name="targetId" value={account.id} />
                  <button type="submit" className="w-full rounded-xl bg-green-50 px-4 py-3 text-left text-sm font-medium text-green-600 active:bg-green-100">
                    Reactivate account
                  </button>
                </form>
              )}
              {actionKeys.includes('suspend') && (
                <form action={suspendStaffAction} onSubmit={e => { if (!window.confirm(`Suspend ${account.display_name}?`)) e.preventDefault() }}>
                  <input type="hidden" name="targetId" value={account.id} />
                  <button type="submit" className="w-full rounded-xl bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-700 active:bg-amber-100">
                    Suspend account
                  </button>
                </form>
              )}

              {/* Danger */}
              {actionKeys.includes('archive') && (
                <button
                  type="button"
                  onClick={() => setShowArchive(true)}
                  className="w-full rounded-xl bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-600 active:bg-red-100"
                >
                  Archive account
                </button>
              )}

            </div>
          </section>
        )}

      </div>

      {/* ── Reset password sheet ── */}
      {showReset && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/40" onClick={() => setShowReset(false)} />
          <div className="fixed left-0 right-0 z-[201] rounded-t-2xl bg-white flex flex-col" style={SHEET_STYLE}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Reset password</h2>
                <p className="text-xs text-gray-400 mt-0.5">{account.display_name}</p>
              </div>
              <button type="button" onClick={() => setShowReset(false)} className="h-8 w-8 flex items-center justify-center text-gray-400 text-xl" aria-label="Close">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {resetState.error   && <p className="rounded-lg bg-red-50   px-3 py-2 text-sm text-red-600">{resetState.error}</p>}
              {resetState.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{resetState.success}</p>}
              <input name="password"     form="reset-form" type="password" minLength={8} required placeholder="New temporary password"     className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <input name="confirmation" form="reset-form" type="password" minLength={8} required placeholder="Confirm temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
            </div>
            <form id="reset-form" action={resetAction} className="flex-shrink-0">
              <input type="hidden" name="targetId" value={account.id} />
              <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setShowReset(false)} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={resetPending} className="flex-1 h-11 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-60">
                  {resetPending ? 'Resetting…' : 'Reset'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Archive sheet ── */}
      {showArchive && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/40" onClick={() => setShowArchive(false)} />
          <div className="fixed left-0 right-0 z-[201] rounded-t-2xl bg-white flex flex-col" style={SHEET_STYLE}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Archive account?</h2>
                <p className="text-xs text-gray-400 mt-0.5">{account.display_name}</p>
              </div>
              <button type="button" onClick={() => setShowArchive(false)} className="h-8 w-8 flex items-center justify-center text-gray-400 text-xl" aria-label="Close">×</button>
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
              <input type="hidden" name="targetId" value={account.id} />
              <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
                <button type="button" onClick={() => setShowArchive(false)} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-medium text-gray-700">Cancel</button>
                <button type="submit" disabled={archivePending} className="flex-1 h-11 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-60">
                  {archivePending ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </main>
  )
}
