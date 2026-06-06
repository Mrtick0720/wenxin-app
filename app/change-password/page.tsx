import ChangePasswordForm from './ChangePasswordForm'

export default function ChangePasswordPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-950">Create your password</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Replace the temporary password before entering Wenxin.
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  )
}
