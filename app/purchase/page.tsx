import { todayLocalStr } from '@/lib/dateUtils'
import PurchaseClient from './PurchaseClient'
import { requireRole } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PurchasePage() {
  await requireRole('owner', 'manager', 'kitchen')
  const supabase = await createServerSupabaseClient()
  const today = todayLocalStr()
  const { data } = await supabase
    .from('purchase_items')
    .select('*')
    .eq('date', today)
    .order('id', { ascending: true })
  return <PurchaseClient initialItems={data || []} initialDate={today} />
}
