'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigation } from '../components/NavigationStack'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import ComplaintDetail from './ComplaintDetail'
import ComplaintForm from './ComplaintForm'
import AnalyticsPage from './AnalyticsPage'
import { useStaff } from '../components/StaffProvider'
import type { Complaint, StaffRole } from './types'
import {
  severityConfig, statusConfig, methodLabel,
  canEditComplaint, canCloseComplaint, canAssignResolution, canAssignStaffAction,
} from './types'
import { seedComplaints, emptyComplaint } from './seed'

const typeOptions    = ['All', 'Food Quality', 'Service', 'Delivery', 'Cleanliness', 'Other']
const statusOptions   = ['All', 'open', 'handling', 'resolved', 'closed']
const dateOptions     = ['All', 'Today', 'Last 7 days', 'Last 30 days']
const sortOptions     = ['Newest', 'Oldest', 'Highest Severity']

export default function ComplaintsClient() {
  const staff = useStaff()
  const role = (staff?.role ?? 'front_desk') as StaffRole
  const { push, pop } = useNavigation()

  const [complaints, setComplaints] = useState<Complaint[]>(seedComplaints)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterDate, setFilterDate] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')
  const [form, setForm] = useState<Complaint | null>(null)

  // ── Filters ──
  const filtered = useMemo(() => {
    let list = [...complaints]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.description.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q) ||
        c.complaintId.toLowerCase().includes(q)
      )
    }
    if (filterType !== 'All') list = list.filter(c => c.type === filterType)
    if (filterStatus !== 'All') list = list.filter(c => c.status === filterStatus)
    if (filterDate === 'Today') {
      const today = new Date().toISOString().split('T')[0]
      list = list.filter(c => c.date === today)
    } else if (filterDate === 'Last 7 days') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
      list = list.filter(c => new Date(c.date) >= cutoff)
    } else if (filterDate === 'Last 30 days') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
      list = list.filter(c => new Date(c.date) >= cutoff)
    }

    // Exclude archived
    list = list.filter(c => !c.archivedAt)

    // Sort
    if (sortBy === 'Newest') list.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    else if (sortBy === 'Oldest') list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    else if (sortBy === 'Highest Severity') {
      const order: Record<string, number> = { high: 3, medium: 2, low: 1 }
      list.sort((a, b) => (order[b.severity]||0) - (order[a.severity]||0))
    }

    return list
  }, [complaints, search, filterType, filterStatus, filterDate, sortBy])

  const total = complaints.filter(c => !c.archivedAt).length
  const unresolved = complaints.filter(c => !c.archivedAt && c.status !== 'resolved' && c.status !== 'closed').length

  // ── Shared: open Complaint Analysis (the exact action of the blue Analysis button) ──
  const openComplaintAnalysis = () => {
    push('/complaints/analytics', <AnalyticsPage complaints={complaints} />)
  }

  // Keep latest values for the once-attached swipe listener
  const openRef = useRef(openComplaintAnalysis)
  openRef.current = openComplaintAnalysis
  const popRef = useRef(pop)
  popRef.current = pop
  const formOpenRef = useRef(false)
  formOpenRef.current = !!form

  // ── Left swipe on the list = shortcut for the Analysis button ──
  // Uses TouchEvents (not PointerEvents) — matches AnalyticsPage pattern that works on Android Chrome.
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let sx = 0, sy = 0, tracking = false, axis: 'h' | 'v' | null = null
    const onStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      const t = e.touches[0]
      sx = t.clientX; sy = t.clientY; tracking = true; axis = null
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking || formOpenRef.current) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (axis !== 'h') return
      e.preventDefault() // prevent browser scroll from consuming horizontal movement
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      if (formOpenRef.current || axis !== 'h') return
      const dx = e.changedTouches[0].clientX - sx
      if (dx < -60) {
        openRef.current()
      } else if (sx > 30 && dx > 60) {
        popRef.current()
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  // ── Actions ──
  function openNew() {
    setForm(emptyComplaint(Math.max(0, ...complaints.map(c => c.id)) + 1))
  }

  function openDetail(c: Complaint) {
    push(`/complaints/${c.id}`, (
      <ComplaintDetail
        complaint={c}
        allComplaints={[]}
        onUpdate={(updated) => setComplaints(prev => prev.map(x => x.id === updated.id ? updated : x))}
        onDelete={(id) => setComplaints(prev => prev.filter(x => x.id !== id))}
        role={role}
      />
    ))
  }

  function saveForm() {
    if (!form) return
    const exists = complaints.find(c => c.id === form.id)
    if (exists) {
      setComplaints(prev => prev.map(c => c.id === form.id ? form : c))
    } else {
      setComplaints(prev => [...prev, form])
    }
    setForm(null)
  }

  function deleteForm(id: number) {
    setComplaints(prev => prev.filter(c => c.id !== id))
    setForm(null)
  }

  return (
    <PageTransition>
    <main ref={rootRef} className="bg-gray-50 w-full mx-auto min-h-screen" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Quality Issues</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openComplaintAnalysis}
            className="text-xs text-blue-500 font-medium px-2 py-1 rounded-lg border border-blue-200 active:bg-blue-50">
            Analysis
          </button>
          <span className="text-xs text-red-400 font-medium">{unresolved} unresolved</span>
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500 mb-3">Today&apos;s Summary</div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{total}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{unresolved}</div>
              <div className="text-xs text-gray-400 mt-0.5">Unresolved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{complaints.filter(c => !c.archivedAt && c.status === 'resolved').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Resolved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">{complaints.filter(c => !c.archivedAt && c.status === 'closed').length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Closed</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search quality issues..."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
            {typeOptions.map(o => <option key={o} value={o}>{o === 'All' ? 'All Categories' : o}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
            {statusOptions.map(o => <option key={o} value={o}>{o === 'All' ? 'All Status' : statusConfig[o]?.label ?? o}</option>)}
          </select>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
            {dateOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs ml-auto">
            {sortOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Complaint List */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">
            {filterDate === 'Today' ? "Today's Quality Issues" : 'Quality Issues'} ({filtered.length})
          </div>
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 py-8">No quality issues found</div>
            )}
            {filtered.map((c) => {
              const sev = severityConfig[c.severity] || severityConfig.low
              const st = statusConfig[c.status] || statusConfig.open
              const method = methodLabel[c.complaintMethod] || c.complaintMethod
              return (
                <button
                  key={c.id}
                  onClick={() => openDetail(c)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sev.color}`}>{sev.label}</span>
                      <span className="text-xs text-gray-400">{c.type}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{method}</span>
                    </div>
                    <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1">{c.description}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{c.customer}</span>
                    <span>{c.date} {c.time}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Workflow + Archive */}
        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="text-[11px] text-blue-400 space-y-0.5">
            <div><strong>Workflow:</strong> Staff → draft | Supervisor → assign + resolve | Manager → action + close</div>
          </div>
          <button
            onClick={() => {
              const el = complaints.filter(c => !!c.archivedAt)
              push('/complaints/archive', <ArchiveView complaints={el} />)
            }}
            className="mt-2 text-xs text-blue-500 font-medium underline">
            View Archive ({complaints.filter(c => !!c.archivedAt).length})
          </button>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 w-12 h-12 bg-orange-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-30 active:bg-orange-600 transition-colors"
        aria-label="Add Quality Issue">+</button>

      {/* Form modal */}
      {form && (
        <ComplaintForm
          form={form}
          onChange={setForm}
          onSave={saveForm}
          onCancel={() => setForm(null)}
          onDelete={() => deleteForm(form.id)}
          isNew={!complaints.find(c => c.id === form.id)}
          canResolve={canAssignResolution(role)}
          canAction={canAssignStaffAction(role)}
          canClose={canCloseComplaint(role)}
          canDelete={role === 'owner' || role === 'manager'}
        />
      )}

    </main>
    </PageTransition>
  )
}

// ── Inline Archive View ──
function ArchiveView({ complaints }: { complaints: Complaint[] }) {
  return (
    <div className="bg-gray-50 w-full mx-auto min-h-screen">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
        <span className="font-semibold text-base">Archive</span>
        <span className="text-xs text-gray-400">{complaints.length} records</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {complaints.length === 0 && <div className="text-center text-gray-400 py-8">No archived quality issues</div>}
        {complaints.map(c => {
          const sev = severityConfig[c.severity] || severityConfig.low
          const st = statusConfig[c.status] || statusConfig.open
          return (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sev.color}`}>{sev.label}</span>
                  <span className="text-xs text-gray-400">{c.type}</span>
                </div>
                <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>
              <div className="font-semibold text-gray-900 text-sm">{c.description}</div>
              <div className="text-xs text-gray-400 mt-1">
                {c.customer} · {c.date} · Archived {c.archivedAt}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
