import BentoClient from './BentoClient'
import PageTransition from '../components/PageTransition'
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { StaffRole } from '@/lib/auth/types'
import type { SupabaseClient } from '@supabase/supabase-js'

async function getBentoOrders(supabase: SupabaseClient, role: StaffRole) {
  const today = new Date().toISOString().split('T')[0]
  const source = role === 'kitchen' ? 'bento_kitchen_orders' : 'bento_orders'
  const { data } = await supabase
    .from(source)
    .select('*')
    .eq('date', today)
    .neq('status', 'canceled')
    .order('id', { ascending: true })
  return data || []
}

export default async function BentoPage() {
  const staff = await requireCurrentStaff()
  const supabase = await createServerSupabaseClient()
  const orders = await getBentoOrders(supabase, staff.role)

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-50 w-full mx-auto relative">
        <BentoClient initialOrders={orders} role={staff.role} />
      </main>
    </PageTransition>
  )
}
