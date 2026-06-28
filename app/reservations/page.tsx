'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { todayLocalStr, isValidDateStr } from '@/lib/dateUtils'
import BackButton from '../components/BackButton'
import PageTransition from '../components/PageTransition'
import DatePicker from '../components/DatePicker'
import ReservationDetail from './ReservationDetail'
import NewReservationSheet from './NewReservationSheet'
import { useReservationsRealtime } from './useReservationsRealtime'
import {
  fetchReservationsAction,
  deleteReservationAction,
  type FullReservation,
} from './actions'
import { useStaff } from '../components/StaffProvider'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { FullPageSpinner } from '../components/Spinner'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

export type ReservationRow = FullReservation

export const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-100',   text: 'text-green-700'  },
  pending:   { label: 'Pending',   bg: 'bg-orange-100',  text: 'text-orange-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100',     text: 'text-red-600'    },
  completed: { label: 'Completed', bg: 'bg-blue-100',    text: 'text-blue-700'   },
  no_show:   { label: 'No Show',   bg: 'bg-gray-200',    text: 'text-gray-700'   },
}

// ── Celebration dots — subtle floating decoration around hero count ──────
function CelebrationDots() {
  // Static decorative dots in orange/blue, positioned around the count area.
  const dots = [
    { x: 12,  y: 8,  size: 6, color: '#f97316', delay: '0s' },
    { x: 80,  y: 20, size: 4, color: '#3b82f6', delay: '0.15s' },
    { x: 20,  y: 70, size: 5, color: '#f97316', delay: '0.3s' },
    { x: 75,  y: 65, size: 7, color: '#3b82f6', delay: '0.1s' },
    { x: 45,  y: 88, size: 4, color: '#f97316', delay: '0.25s' },
    { x: 8,   y: 40, size: 3, color: '#3b82f6', delay: '0.2s' },
    { x: 88,  y: 42, size: 5, color: '#f97316', delay: '0.05s' },
  ]
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            backgroundColor: d.color,
            opacity: 0.55,
            animation: `dot-float 2.5s ease-in-out ${d.delay} infinite`,
          }}
        />
      ))}
    </>
  )
}

export default function ReservationsPage({ initialDate }: { initialDate?: string } = {}) {
  const staff = useStaff()
  // Normalize as a plain string so a legacy 'boss' value (removed from the role
  // enum) still maps to owner without a no-overlap type error on the comparison.
  const rawRole: string = staff?.role ?? 'other'
  const role = rawRole === 'boss' ? 'owner' : rawRole
  const canEdit = role === 'owner' || role === 'manager' || role === 'front_desk'
  const canEditDetails = role === 'owner' || role === 'manager'
  const canDeleteHistory = role === 'owner' || role === 'manager'

  const today = todayLocalStr()
  // Stack navigation (Home card → push) passes the focused date as a prop since
  // it never updates window.location. Direct URL access (/reservations?date=…)
  // has no prop; that case is handled by the effect below. Invalid/missing →
  // today.
  const [selectedDate, setSelectedDate] = useState(
    isValidDateStr(initialDate) ? initialDate : today,
  )
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())

  // Direct-URL fallback: when not rendered through the client stack there is no
  // initialDate prop, so read the query param from the address bar on mount.
  // Runs once; SSR-safe (window guarded). The stack path already has the date
  // from the prop, so it skips this.
  useEffect(() => {
    if (initialDate !== undefined || typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search).get('date')
    if (isValidDateStr(q)) setSelectedDate(q)
  }, [initialDate])

  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [canSeePii, setCanSeePii] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'history'>('active')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [editTarget, setEditTarget] = useState<ReservationRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReservationRow | null>(null)

  // Client-side filter by tab
  const activeList = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed')
  const historyList = reservations.filter(r => r.status === 'completed' || r.status === 'cancelled' || r.status === 'no_show')
  const displayList = tab === 'active' ? activeList : historyList
  const activeCount = activeList.length
  const historyCount = historyList.length
  const total = displayList.length

  // Fetch reservation dates for the marker dots (±14 days around today)
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 14)
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    d.setDate(d.getDate() + 28)
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    supabase
      .from('reservations')
      .select('date')
      .gte('date', from)
      .lte('date', to)
      .in('status', ['confirmed', 'pending'])
      .then(({ data }) => {
        if (data) setMarkedDates(new Set(data.map(r => r.date)))
      })
  }, [today])

  const load = useCallback(async (date: string) => {
    const res = await fetchReservationsAction(date)
    if (res.ok) {
      setReservations(res.data.reservations as ReservationRow[])
      setCanSeePii(res.data.canSeePii)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    async function refresh() {
      if (active) setLoading(true)
      await load(selectedDate)
      if (active) setLoading(false)
    }
    refresh()
    return () => { active = false }
  }, [selectedDate, load])

  useReservationsRealtime(() => load(selectedDate))

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteReservationAction(deleteTarget.id)
    setReservations(prev => prev.filter(r => r.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const selected = selectedIndex !== null ? displayList[selectedIndex] ?? null : null

  function openDetail(index: number) {
    setSelectedIndex(index)
  }

  function renderRow(r: ReservationRow, i: number) {
    const timeLabel = r.time_end
      ? `${fmtTime(r.time_start)}–${fmtTime(r.time_end)}`
      : fmtTime(r.time_start)

    const rowBg = i % 2 === 1 ? '#f9fafb' : '#ffffff'
    const st = statusConfig[r.status] ?? statusConfig.pending
    const preorder = r.preordered_dishes

    const statusPill = (
      <span className={`text-[11px] font-semibold rounded-full flex-shrink-0 ${st.bg} ${st.text}`}
        style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, lineHeight: '1.4' }}>
        {st.label}
      </span>
    )

    if (canSeePii) {
      return (
        <div key={r.id} className="flex items-stretch" style={{ background: rowBg }}>
          <button type="button" onClick={() => openDetail(i)}
            className="flex-1 text-left min-w-0 active:opacity-75"
            style={{ padding: '18px 16px', minHeight: 88 }}>
            {/* Row 1: time (left, big orange) + customer name (right, big dark) */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="tabular-nums flex-shrink-0"
                style={{ fontSize: 28, fontWeight: 700, color: '#f97316', lineHeight: 1 }}>
                {timeLabel}
              </span>
              <span className="truncate text-right min-w-0"
                style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                {r.customer_name}
              </span>
            </div>
            {/* Row 2: preordered dishes — hidden when empty */}
            {preorder && (
              <div className="truncate"
                style={{ marginTop: 8, fontSize: 14, color: '#9ca3af', lineHeight: 1.4 }}>
                {preorder}
              </div>
            )}
            {/* Row 3: status pill (left) + pax · table (right) */}
            <div className="flex items-center justify-between gap-2" style={{ marginTop: 10 }}>
              {statusPill}
              <div className="flex items-center gap-1.5 flex-shrink-0"
                style={{ fontSize: 13, color: '#9ca3af' }}>
                <span>{r.pax} pax</span>
                {r.table_area && (
                  <>
                    <span>·</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{r.table_area}</span>
                  </>
                )}
              </div>
            </div>
          </button>
          {/* Delete — History tab only, owner/manager only */}
          {tab === 'history' && canDeleteHistory && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}
              className="px-3 flex items-center text-gray-300 active:text-red-500 flex-shrink-0"
              aria-label={`Delete ${(r as FullReservation).customer_name}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      )
    }

    // Restricted view (kitchen / other) — no customer name, phone, or notes
    return (
      <button key={r.id} type="button" onClick={() => openDetail(i)}
        className="w-full text-left active:opacity-75"
        style={{ background: rowBg, padding: '18px 16px', minHeight: 88 }}>
        {/* Row 1: time (left, big orange) + pax (right) */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="tabular-nums flex-shrink-0"
            style={{ fontSize: 28, fontWeight: 700, color: '#f97316', lineHeight: 1 }}>
            {timeLabel}
          </span>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#6b7280', lineHeight: 1 }}>
            {r.pax} pax
          </span>
        </div>
        {/* Row 2: preordered dishes — hidden when empty */}
        {preorder && (
          <div className="truncate"
            style={{ marginTop: 8, fontSize: 14, color: '#9ca3af', lineHeight: 1.4 }}>
            {preorder}
          </div>
        )}
        {/* Row 3: status pill (left) + table (right) */}
        <div className="flex items-center justify-between gap-2" style={{ marginTop: 10 }}>
          {statusPill}
          {r.table_area && (
            <span style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
              {r.table_area}
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
    <PageTransition>
    <main className="bg-gray-50 w-full mx-auto min-h-screen">

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/" />
          <span className="font-semibold text-base">Reservations</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setShowNew(true)} aria-label="Add reservation"
            className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-80"
            style={{ background: '#f97316' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Segmented tabs */}
      <div className="bg-white px-4 pt-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => { setTab('active'); setSelectedIndex(null) }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'active' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
            }`}
          >
            Active{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <button
            onClick={() => { setTab('history'); setSelectedIndex(null) }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'history' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
            }`}
          >
            History{historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
        </div>
      </div>

      {/* Bento-style date picker with reservation markers */}
      <div className="bg-white px-4 pt-2 pb-1 border-b border-gray-50">
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          markedDates={markedDates}
        />
      </div>

      <div className="px-4 py-4 pb-28 space-y-4">

        {/* Hero card — shows active count */}
        {loading && <FullPageSpinner />}
        {!loading && (
          <div className="relative bg-white rounded-2xl p-6 shadow-sm text-center overflow-hidden">
            {activeCount > 0 && <CelebrationDots />}
            <div className="relative z-10">
              <div className="text-5xl font-bold text-gray-900">{activeCount}</div>
              <div className="text-sm text-gray-500 mt-2">
                {activeCount === 0
                  ? `No active reservations for ${fmtDate(selectedDate)}`
                  : `You have ${activeCount} active reservation${activeCount !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {!loading && total === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-sm text-gray-400">
              {tab === 'active' ? 'No active reservations for this date' : 'No history for this date'}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden shadow-sm">
            {displayList.map((r, i) => renderRow(r, i))}
          </div>
        )}

      </div>

      {showNew && (
        <NewReservationSheet
          date={selectedDate}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(selectedDate) }}
        />
      )}

      {editTarget && (
        <NewReservationSheet
          date={selectedDate}
          edit={{
            id: editTarget.id,
            customer_name: editTarget.customer_name ?? '',
            phone: editTarget.phone ?? null,
            date: editTarget.date,
            time_start: editTarget.time_start,
            time_end: editTarget.time_end ?? null,
            pax: editTarget.pax,
            table_area: editTarget.table_area ?? null,
            preordered_dishes: editTarget.preordered_dishes ?? null,
            notes: editTarget.notes ?? null,
          }}
          onClose={() => setEditTarget(null)}
          onCreated={() => {
            setEditTarget(null)
            // If date changed, reload with new selected date
            load(selectedDate)
          }}
        />
      )}

      {selected && selectedIndex !== null && (
        <ReservationDetail
          reservation={selected}
          canSeePii={canSeePii}
          canEdit={canEdit}
          index={selectedIndex}
          total={total}
          onPrev={selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : undefined}
          onNext={selectedIndex < total - 1 ? () => setSelectedIndex(selectedIndex + 1) : undefined}
          onClose={() => setSelectedIndex(null)}
          onEdit={canEditDetails ? () => {
            if (selected) {
              setEditTarget(selected)
              setSelectedIndex(null)
            }
          } : undefined}
          onStatusChanged={(id, status) => {
            // Update status in place — the tab filter handles Active vs History.
            setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
            // Close detail — the item may have moved to the other tab.
            setSelectedIndex(null)
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed flex items-center justify-center"
          style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl mx-6 p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-base font-semibold text-gray-900">Delete Reservation</div>
              <div className="text-sm text-gray-500 mt-2">
                Delete <strong>{deleteTarget.customer_name}</strong> permanently?
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 active:opacity-80">
                Cancel
              </button>
              <button type="button" onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:opacity-80"
                style={{ background: '#ef4444' }}>
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

    </main>
    </PageTransition>
  )
}
