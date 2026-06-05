import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import PurchaseClient from './PurchaseClient'

export const dynamic = 'force-dynamic'

export default async function PurchasePage() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('purchase_items')
    .select('*')
    .eq('date', today)
    .order('id', { ascending: true })
  return <PurchaseClient initialItems={data || []} initialDate={today} />
}
