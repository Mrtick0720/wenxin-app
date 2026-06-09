import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { canManageTemplates } from '@/lib/checklist/permissions'
import { redirect } from 'next/navigation'
import BackButton from '@/app/components/BackButton'
import PageTransition from '@/app/components/PageTransition'

export const dynamic = 'force-dynamic'

export default async function ChecklistTemplatesPage() {
  const staff = await requireCurrentStaff()

  if (!canManageTemplates(staff.role)) {
    redirect('/access-denied')
  }

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-10">
          <BackButton href="/checklist" />
          <span className="font-semibold text-base">Checklist Templates</span>
        </div>

        <div className="px-4 py-4 pb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-3">📝</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">
              Template Management
            </div>
            <div className="text-xs text-gray-400">
              Not yet implemented — template editing coming in next phase
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
