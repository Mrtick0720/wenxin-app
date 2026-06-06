import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-950">Access denied</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          You do not have access to this area.
        </p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-gray-900 px-5 text-sm font-semibold text-white">
          Return home
        </Link>
      </div>
    </main>
  )
}
