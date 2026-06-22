'use client'

import { useState, useEffect, useCallback } from 'react'
import BackButton from '../../components/BackButton'
import { supabase } from '@/lib/supabase/client'
import { useStaff } from '@/app/components/StaffProvider'

type ComponentItem = { id: number; name: string; description: string | null; is_active: boolean; is_rice?: boolean }
type Tab = 'proteins' | 'vegetables' | 'staples'

const TABS: { key: Tab; label: string; table: string }[] = [
  { key: 'proteins', label: 'Proteins', table: 'bento_proteins' },
  { key: 'vegetables', label: 'Vegetables', table: 'bento_vegetables' },
  { key: 'staples', label: 'Staples', table: 'bento_staples' },
]

export default function ComponentsPage() {
  const staff = useStaff()
  const canEdit = staff?.role === 'owner' || staff?.role === 'manager'
  const [tab, setTab] = useState<Tab>('proteins')
  const [items, setItems] = useState<ComponentItem[]>([])
  const [loading, setLoading] = useState(true)

  // Add/edit state
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formRice, setFormRice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const table = TABS.find(t => t.key === tab)!.table

  const load = useCallback(async () => {
    setLoading(true)
    const select = tab === 'staples' ? '*' : 'id,name,description,is_active'
    const { data } = await supabase.from(table).select(select).order('name')
    setItems((data || []) as unknown as ComponentItem[])
    setLoading(false)
  }, [tab, table])

  useEffect(() => {
    async function refresh() { await load() }
    refresh()
  }, [load])

  function openAdd() {
    setEditId(null); setFormName(''); setFormDesc(''); setFormRice(false)
    setError(null); setShowForm(true)
  }
  function openEdit(item: ComponentItem) {
    setEditId(item.id); setFormName(item.name); setFormDesc(item.description ?? '')
    setFormRice(item.is_rice ?? false)
    setError(null); setShowForm(true)
  }

  async function save() {
    if (!formName.trim()) { setError('Name is required.'); return }
    setSaving(true); setError(null)
    const payload: Record<string, unknown> = { name: formName.trim(), description: formDesc.trim() || null }
    if (tab === 'staples') payload.is_rice = formRice

    const { error: err } = editId
      ? await supabase.from(table).update(payload).eq('id', editId)
      : await supabase.from(table).insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); load()
  }

  async function toggleActive(item: ComponentItem) {
    await supabase.from(table).update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !item.is_active } : i))
  }

  return (
    <main className="min-h-screen bg-gray-50 w-full mx-auto">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/bento" />
          <span className="font-semibold text-base">Components</span>
        </div>
        {canEdit && (
          <button type="button" onClick={openAdd}
            className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-80"
            style={{ background: '#f97316' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 pt-2 border-b border-gray-50">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        {/* Add/Edit form */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="font-semibold text-sm text-gray-800">
              {editId ? 'Edit' : 'Add'} {TABS.find(t => t.key === tab)!.label.slice(0, -1)}
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                placeholder="e.g. Sliced Chicken" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                placeholder="Optional" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
            </div>
            {tab === 'staples' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formRice} onChange={e => setFormRice(e.target.checked)} />
                Is Rice
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No {TABS.find(t => t.key === tab)!.label.toLowerCase()} yet</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
            {items.map(item => (
              <div key={item.id} className="flex items-center px-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${item.is_active ? 'text-gray-800' : 'text-gray-300 line-through'}`}>
                    {item.description || item.name}
                  </span>
                  {item.description && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{item.name}</div>}
                  {tab === 'staples' && item.is_rice && <span className="text-[10px] text-blue-500 ml-1">🍚</span>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(item)}
                      className={`text-xs px-2 py-1 rounded-lg ${item.is_active ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => openEdit(item)}
                      className="text-xs text-orange-500 px-2 py-1">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
