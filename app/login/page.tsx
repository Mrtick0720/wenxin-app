import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const params = await searchParams

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-900 text-lg font-bold text-white">
          W
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-950">Wenxin</h1>
        <p className="mt-1 text-sm text-gray-500">Restaurant operations</p>
        <LoginForm sessionEnded={params.reason === 'session-ended'} />
        <p className="mt-6 text-center text-xs text-gray-400">
          Staff access only
        </p>
      </div>
    </main>
  )
}
