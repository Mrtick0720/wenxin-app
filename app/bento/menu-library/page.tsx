'use client'

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useStaff } from '@/app/components/StaffProvider'

type Variant = { id: number; code: string; name: string }
type LibraryItem = { id: number; variant_id: number; variant_code?: string; variant_name?: string; dish_name: string; description: string | null }

export default function MenuLibraryPage() {
  const staff = useStaff()
  const canEdit = staff?.role === 'owner' || staff?.role === 'manager'
  const [variants, setVariants] = useState<Variant[]>([])
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  // New item form
  const [showForm, setShowForm] = useState(false)
  const [newVariant, setNewVariant] = useState<number>(0)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: vData }, { data: lData }] = await Promise.all([
      supabase.from('bento_menu_variants').select('id,code,name').eq('is_active', true).order('display_order'),
      supabase.from('bento_menu_library').select('*, bento_menu_variants!inner(code,name)').order('dish_name'),
    ])
    setVariants((vData || []) as Variant[])
    setItems(((lData || []) as unknown as Record<string, unknown>[]).map(r => {
      const v = r.bento_menu_variants as Record<string, unknown> | null
      return {
        id: r.id as number, variant_id: r.variant_id as number,
        variant_code: v?.code as string | undefined, variant_name: v?.name as string | undefined,
        dish_name: r.dish_name as string, description: (r.description as string) ?? null,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    async function refresh() { await load() }
    refresh()
  }, [load])

  async function addItem() {
    if (!newName.trim() || !newVariant) { setError('Please select a variant and enter a name.'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('bento_menu_library')
      .insert({ variant_id: newVariant, dish_name: newName.trim() })
    setSaving(false)
    if (err) { setError(err.message); return }
    setNewName(''); setShowForm(false)
    load()
  }

  async function deleteItem(id: number) {
    await supabase.from('bento_menu_library').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <main className="min-h-screen bg-gray-50"><div className="p-8 text-center text-gray-400">Loading...</div></main>

  return (
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/bento" />
          <span className="font-semibold text-base">Menu Library</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowForm(!showForm)}
            className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-80"
            style={{ background: '#f97316' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Variant</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                value={newVariant} onChange={e => setNewVariant(Number(e.target.value))}>
                <option value={0}>Select variant...</option>
                {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Dish Name</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                placeholder="e.g. Sliced Chicken with Cucumber" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <button type="button" onClick={addItem} disabled={saving}
              className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium">
              {saving ? 'Adding...' : 'Add to Library'}
            </button>
          </div>
        )}

        {variants.map(variant => {
          const variantItems = items.filter(i => i.variant_id === variant.id)
          return (
            <div key={variant.id}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{variant.name}</div>
              {variantItems.length === 0 ? (
                <div className="text-sm text-gray-400 py-3">No {variant.name} dishes yet</div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
                  {variantItems.map(item => (
                    <div key={item.id} className="flex items-center px-4 py-3">
                      <span className="text-sm text-gray-800 flex-1">{item.dish_name}</span>
                      {canEdit && (
                        <button type="button" onClick={() => deleteItem(item.id)}
                          className="text-gray-300 active:text-red-500 p-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
