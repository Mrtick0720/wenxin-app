import { supabase } from '@/lib/supabase'
import { todayLocalStr } from '@/lib/dateUtils'
import BentoClient from './BentoClient'
import PageTransition from '../components/PageTransition'

async function getBentoOrders() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('bento_orders')
    .select('*')
    .eq('date', today)
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
