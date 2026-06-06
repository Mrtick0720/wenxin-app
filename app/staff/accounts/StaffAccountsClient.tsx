'use client'

import { useActionState, useMemo, useState } from 'react'
import type { StaffRole } from '@/lib/auth/types'
import {
  changeStaffRoleAction,
  createStaffAction,
  forceLogoutStaffAction,
  reactivateStaffAction,
  resetStaffPasswordAction,
  suspendStaffAction,
  type AccountActionState,
} from './actions'

export type StaffAccountRow = {
  id: string
  staff_id: string
  display_name: string
  role: StaffRole
  active: boolean
  last_login_at: string | null
  session_active: boolean
}

const initialState: AccountActionState = { error: '', success: '' }
const roles: Array<{ value: StaffRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'front_desk', label: 'Front Desk' },
]

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuching',
  }).format(new Date(value))
}

export default function StaffAccountsClient({
  accounts,
  ownerId,
}: {
  accounts: StaffAccountRow[]
  ownerId: string
}) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState<StaffAccountRow | null>(null)
  const [createState, createAction, createPending] = useActionState(createStaffAction, initialState)
  const [resetState, resetAction, resetPending] = useActionState(resetStaffPasswordAction, initialState)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return accounts.filter(account => {
      const matchesQuery = !normalized ||
        account.display_name.toLowerCase().includes(normalized) ||
        account.staff_id.toLowerCase().includes(normalized)
      return matchesQuery && (roleFilter === 'all' || account.role === roleFilter)
    })
  }, [accounts, query, roleFilter])

  return (
    <>
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
          {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-11 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white"
        >
          Create
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map(account => {
          const isCurrentOwner = account.id === ownerId
          return (
            <article key={account.id} className="rounded-lg border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-gray-900">{account.display_name}</h2>
                    <span className={`h-2 w-2 rounded-full ${account.session_active ? 'bg-green-500' : 'bg-gray-300'}`} aria-label={account.session_active ? 'Online' : 'Offline'} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{account.staff_id}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${account.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {account.active ? 'Active' : 'Suspended'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-400">Role</div>
                  {isCurrentOwner ? (
                    <div className="mt-1 font-medium text-gray-700">Owner</div>
                  ) : (
                    <form action={changeStaffRoleAction} className="mt-1 flex gap-1.5">
                      <input type="hidden" name="targetId" value={account.id} />
                      <select name="role" defaultValue={account.role} className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs">
                        {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                      <button type="submit" className="h-8 rounded-md bg-gray-100 px-2 font-medium text-gray-600">Save</button>
                    </form>
                  )}
                </div>
                <div>
                  <div className="text-gray-400">Last login</div>
                  <div className="mt-1 font-medium text-gray-700">{formatDate(account.last_login_at)}</div>
                </div>
              </div>

              {!isCurrentOwner && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <button type="button" onClick={() => setResetTarget(account)} className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
                    Reset password
                  </button>
                  {account.session_active && (
                    <form action={forceLogoutStaffAction} onSubmit={event => {
                      if (!window.confirm(`Force ${account.display_name} to sign out?`)) event.preventDefault()
                    }}>
                      <input type="hidden" name="targetId" value={account.id} />
                      <button type="submit" className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Force logout</button>
                    </form>
                  )}
                  <form
                    action={account.active ? suspendStaffAction : reactivateStaffAction}
                    onSubmit={event => {
                      const verb = account.active ? 'suspend' : 'reactivate'
                      if (!window.confirm(`${verb} ${account.display_name}?`)) event.preventDefault()
                    }}
                  >
                    <input type="hidden" name="targetId" value={account.id} />
                    <button type="submit" className={`rounded-md px-3 py-2 text-xs font-medium ${account.active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {account.active ? 'Suspend' : 'Reactivate'}
                    </button>
                  </form>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create staff account</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 w-8 text-xl text-gray-400" aria-label="Close">×</button>
            </div>
            {createState.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{createState.error}</p>}
            {createState.success && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{createState.success}</p>}
            <form action={createAction} className="mt-4 space-y-3">
              <input name="displayName" required placeholder="Display name" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <input name="staffId" required autoCapitalize="none" placeholder="Staff ID" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <select name="role" required defaultValue="front_desk" className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm">
                {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <input name="password" type="password" minLength={8} required placeholder="Temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <button type="submit" disabled={createPending} className="h-11 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white disabled:opacity-60">
                {createPending ? 'Creating...' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>
                <p className="text-sm text-gray-400">{resetTarget.display_name}</p>
              </div>
              <button type="button" onClick={() => setResetTarget(null)} className="h-8 w-8 text-xl text-gray-400" aria-label="Close">×</button>
            </div>
            {resetState.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{resetState.error}</p>}
            {resetState.success && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{resetState.success}</p>}
            <form action={resetAction} className="mt-4 space-y-3">
              <input type="hidden" name="targetId" value={resetTarget.id} />
              <input name="password" type="password" minLength={8} required placeholder="New temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <input name="confirmation" type="password" minLength={8} required placeholder="Confirm temporary password" className="h-11 w-full rounded-lg border border-gray-200 px-3 text-base outline-none focus:border-orange-500" />
              <button type="submit" disabled={resetPending} className="h-11 w-full rounded-lg bg-gray-900 text-sm font-semibold text-white disabled:opacity-60">
                {resetPending ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
