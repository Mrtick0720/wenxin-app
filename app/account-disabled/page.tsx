import { logoutAction } from '@/app/profile/actions'

export default function AccountDisabledPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.7L2.6 17a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-950">Account suspended</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          This account has been suspended. Contact the owner.
        </p>
        <form action={logoutAction} className="mt-6">
          <button type="submit" className="h-11 rounded-lg bg-gray-900 px-5 text-sm font-semibold text-white">
            Return to sign in
          </button>
        </form>
      </div>
    </main>
  )
}
