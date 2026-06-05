import { supabase } from '@/lib/supabase'
import BentoClient from './BentoClient'
import PageTransition from '../components/PageTransition'
import { todayLocalStr } from '@/lib/dateUtils'

async function getBentoOrders() {
  const today = todayLocalStr()
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', today)
    .neq('status', 'canceled')
    .order('id', { ascending: true })
  return data || []
}

export default async function BentoPage() {
  const orders = await getBentoOrders()

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50 w-full mx-auto relative">
        <BentoClient initialOrders={orders} />
      </main>
    </PageTransition>
  )
}
