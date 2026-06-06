'use client'

import { useActionState } from 'react'
import { changePasswordAction, type ChangePasswordState } from './actions'
import { logoutAction } from '@/app/profile/actions'

const initialState: ChangePasswordState = { error: '' }

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState)

  return (
    <div className="mt-8">
      {state.error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
          {state.error}
        </div>
      )}
      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">New password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-12 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</span>
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-12 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <p className="text-xs text-gray-400">Use at least 8 characters.</p>
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Updating...' : 'Update password'}
        </button>
      </form>
      <form action={logoutAction} className="mt-3">
        <button type="submit" className="h-11 w-full text-sm font-medium text-gray-500">
          Sign out
        </button>
      </form>
    </div>
  )
}
