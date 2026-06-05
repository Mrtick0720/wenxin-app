import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import DetailClient from './DetailClient'

export const dynamic = 'force-dynamic'

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await supabase.from('purchase_items').select('*').eq('id', id).single()
  if (!data) notFound()
  return <DetailClient item={data} />
}
