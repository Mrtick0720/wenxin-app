'use client'

import { useState } from 'react'
import BackButton from '../components/BackButton'
import type { Complaint, StaffRole } from './types'
import {
  severityConfig, statusConfig, methodLabel, timelineLabels,
  canEditComplaint, canCloseComplaint, canAssignResolution, canAssignStaffAction,
} from './types'
import ComplaintForm from './ComplaintForm'

interface ComplaintDetailProps {
  complaint: Complaint
  allComplaints: Complaint[]
  onUpdate: (c: Complaint) => void
  onDelete: (id: number) => void
  role: StaffRole
}

export default function ComplaintDetail({ complaint: initial, allComplaints, onUpdate, onDelete, role }: ComplaintDetailProps) {
  const [complaint, setComplaint] = useState<Complaint>(initial)
  const [editing, setEditing] = useState(false)

  const sev = severityConfig[complaint.severity] || severityConfig.low
  const st = statusConfig[complaint.status] || statusConfig.open
  const method = methodLabel[complaint.complaintMethod] || complaint.complaintMethod
  const canEdit = canEditComplaint(role, complaint.createdBy)
  const canDelete = role === 'owner' || role === 'manager'

  function handleSave() {
    onUpdate(complaint)
    setEditing(false)
  }

  if (editing) {
    return (
      <ComplaintForm
        form={complaint}
        onChange={setComplaint}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        onDelete={() => { onDelete(complaint.id); setEditing(false) }}
        isNew={false}
        canResolve={canAssignResolution(role)}
        canAction={canAssignStaffAction(role)}
        canClose={canCloseComplaint(role)}
        canDelete={canDelete}
      />
    )
  }

  return (
    <div className="bg-gray-50 w-full mx-auto min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackButton href="/complaints" />
          <span className="font-semibold text-base">Quality Issue #{complaint.complaintId}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
          {canEdit && (
            <button onClick={() => setEditing(true)}
              className="text-xs text-orange-500 font-medium px-2 py-1 rounded-lg border border-orange-200 active:bg-orange-50">
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* 1. Complaint Information */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-3">Quality Issue Information</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <KV label="ID" value={`#${complaint.complaintId}`} />
            <KV label="Date" value={complaint.date} />
            <KV label="Category" value={complaint.type} />
            <KV label="Severity" value={sev.label} valueColor={sev.color} />
            <KV label="Method" value={method} />
            <KV label="Status" value={st.label} valueColor={st.color} />
          </div>
          <div className="mt-2 pt-2 border-t border-gray-50">
            <div className="text-[11px] text-gray-500 mb-1">Description</div>
            <div className="text-sm text-gray-900">{complaint.description}</div>
          </div>
        </div>

        {/* 2. Order Information */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-3">Order Information</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <KV label="Customer" value={complaint.customer} />
            <KV label="Table" value={complaint.tableNo || '—'} />
            <KV label="Order ID" value={complaint.orderId || '—'} />
            <KV label="Reservation ID" value={complaint.reservationId || '—'} />
          </div>
        </div>

        {/* 3. Responsibility */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-3">Responsibility</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <KV label="Responsible" value={complaint.responsiblePerson} />
            <KV label="Reported By" value={complaint.reportedBy || complaint.customer} />
            <KV label="Recorded By" value={complaint.recordedBy || complaint.createdBy} />
            <KV label="Closed By" value={complaint.closedBy || '—'} />
          </div>
        </div>

        {/* 4. Resolution */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-3">Resolution</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <KV label="Customer Resolution"
              value={complaint.customerResolution}
              valueColor={complaint.customerResolution === 'Pending' ? 'text-orange-500' : 'text-green-600'} />
            <KV label="Staff Action"
              value={complaint.staffAction}
              valueColor={complaint.staffAction === 'Pending' ? 'text-orange-500' : 'text-gray-700'} />
          </div>
          {complaint.resolutionNotes && (
            <div className="mt-2 pt-2 border-t border-gray-50">
              <div className="text-[11px] text-gray-500 mb-1">Notes</div>
              <div className="text-sm text-gray-700">{complaint.resolutionNotes}</div>
            </div>
          )}
        </div>

        {/* 5. Timeline */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-3">Timeline</div>
          <div className="space-y-0">
            {(['open', 'handling', 'resolved', 'closed'] as const).map((s, i) => {
              const statusOrder = ['open', 'handling', 'resolved', 'closed']
              const currentIdx = statusOrder.indexOf(complaint.status)
              const isActive = i <= currentIdx && currentIdx >= 0
              const isLast = i === 3
              return (
                <div key={s} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-orange-500' : 'bg-gray-200'}`} />
                    {!isLast && <div className={`w-0.5 h-6 ${i < currentIdx ? 'bg-orange-500' : 'bg-gray-200'}`} />}
                  </div>
                  <div className={`pb-3 text-xs ${isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {timelineLabels[s]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}

function KV({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium text-right ${valueColor || 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
