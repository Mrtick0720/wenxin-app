'use client'

import { useStaff } from '@/app/components/StaffProvider'
import BackButton from '@/app/components/BackButton'
import { logoutAction } from './actions'

function formatRole(role: string) {
  return role.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export default function ProfileStack() {
  const staff = useStaff()
  if (!staff) return null

  const expiresAt = new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuching',
  }).format(new Date(staff.expiresAt))

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-3">
        <BackButton href="/" />
        <h1 className="text-base font-semibold text-gray-900">Profile</h1>
      </header>
      <div className="mx-auto max-w-lg px-4 pt-6 pb-28">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-lg font-semibold text-white">
            {staff.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-950">{staff.displayName}</h2>
            <p className="text-sm text-gray-500">{formatRole(staff.role)}</p>
          </div>
        </div>

        <dl className="mt-8 divide-y divide-gray-100 border-y border-gray-100 bg-white">
          <div className="flex items-center justify-between px-4 py-4">
            <dt className="text-sm text-gray-500">Staff ID</dt>
            <dd className="text-sm font-medium text-gray-900">{staff.staffId}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <dt className="text-sm text-gray-500">Role</dt>
            <dd className="text-sm font-medium text-gray-900">{formatRole(staff.role)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <dt className="text-sm text-gray-500">Session ends</dt>
            <dd className="text-right text-sm font-medium text-gray-900">{expiresAt}</dd>
          </div>
        </dl>

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="h-12 w-full rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-600"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
