import { supabase } from '@/lib/supabase'
import Link from 'next/link'
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
    <main className="min-h-screen bg-gray-50 w-full max-w-sm mx-auto relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 text-xl">←</Link>
          <span className="font-semibold text-base">Bento 今日进度</span>
        </div>
        <Link href="/bento/new" className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-full">
          + 新增
        </Link>
      </div>

      <div className="px-4 py-4 pb-8">
        <BentoClient initialOrders={orders} />
      </div>
    </main>
    </PageTransition>
  )
}
