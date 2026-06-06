'use client'

import { useActionState, useState } from 'react'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = { error: '' }

export default function LoginForm({ sessionEnded = false }: { sessionEnded?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="mt-10 space-y-4">
      {sessionEnded && !state.error && (
        <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          Your 12-hour session has ended. Please sign in again.
        </div>
      )}

      {state.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
          {state.error}
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700">Staff ID</span>
        <input
          name="staffId"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-12 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-base text-gray-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700">Password</span>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="h-12 w-full rounded-lg border border-gray-200 bg-white px-3.5 pr-12 text-base text-gray-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword(value => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400"
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 4.2A10.6 10.6 0 0112 4c5 0 9 4.2 10 8a12.8 12.8 0 01-2.2 4.3" />
                <path d="M6.6 6.6A12.3 12.3 0 002 12c1 3.8 5 8 10 8a10.5 10.5 0 005.4-1.5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-12 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white transition active:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
