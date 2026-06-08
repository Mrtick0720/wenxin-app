'use client'

import type { Complaint } from './types'

const typeOptions    = ['Food Quality', 'Service', 'Delivery', 'Cleanliness', 'Other']
const severityOptions = ['low', 'medium', 'high']
const statusOptions   = ['open', 'handling', 'resolved', 'closed']
const methodOptions   = ['On-site Complaint', 'Google Review', 'Foodpanda', 'GrabFood', 'Facebook', 'Online Platform Complaint', 'Reported Complaint', 'Other']
const responsibleOptions = ['Service Staff', 'Kitchen Staff', 'Delivery Staff', 'Manager', 'Unknown']
const resolutionOptions  = ['Pending', 'Apology', 'Remake', 'Discount', 'Refund', 'Free Item', 'Coupon', 'Platform Reply', 'Other']
const staffActionOptions = ['Pending', 'Verbal Reminder', 'Written Warning', 'Training', 'Point Deduction', 'Fine', 'Suspension', 'No Penalty']
const creatorOptions     = ['Front Desk Staff', 'Service Staff', 'Customer Service', 'Shift Supervisor', 'Store Manager']

const severityLabel: Record<string, string> = { high: 'Urgent', medium: 'Normal', low: 'Low' }
const statusLabel: Record<string, string> = { open: 'Open', handling: 'Handling', resolved: 'Resolved', closed: 'Closed' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      {children}
    </label>
  )
}

interface ComplaintFormProps {
  form: Complaint
  onChange: (f: Complaint) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  isNew: boolean
  canResolve: boolean
  canAction: boolean
  canClose: boolean
  canDelete: boolean
}

export default function ComplaintForm({
  form, onChange, onSave, onCancel, onDelete,
  isNew, canResolve, canAction, canClose, canDelete,
}: ComplaintFormProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-orange-500 text-sm font-medium">Cancel</button>
          <span className="font-semibold text-base">{isNew ? 'New Complaint' : 'Edit Complaint'}</span>
        </div>
        <button onClick={onSave}
          className="bg-orange-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg active:bg-orange-600 transition-colors">
          Save
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Field label="Title">
          <input value={form.description} onChange={e => onChange({ ...form, description: e.target.value })}
            placeholder="Complaint title / description"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </Field>

        <Field label="Customer / Source">
          <input value={form.customer} onChange={e => onChange({ ...form, customer: e.target.value })}
            placeholder="e.g. Walk-in Guest, Table 3"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.type} onChange={e => onChange({ ...form, type: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              {typeOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select value={form.severity} onChange={e => onChange({ ...form, severity: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              {severityOptions.map(o => <option key={o} value={o}>{severityLabel[o] ?? o}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Complaint Method">
            <select value={form.complaintMethod} onChange={e => onChange({ ...form, complaintMethod: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              {methodOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status}
              onChange={e => onChange({ ...form, status: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              {statusOptions.map(o => (
                <option key={o} value={o} disabled={o === 'closed' && !canClose}>
                  {statusLabel[o] ?? o}{o === 'closed' && !canClose ? ' (manager)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Order ID">
            <input value={form.orderId || ''} onChange={e => onChange({ ...form, orderId: e.target.value })}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Table Number">
            <input value={form.tableNo || ''} onChange={e => onChange({ ...form, tableNo: e.target.value })}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </Field>
        </div>

        <Field label="Responsible Person">
          <select value={form.responsiblePerson}
            onChange={e => onChange({ ...form, responsiblePerson: e.target.value })}
            disabled={!canResolve}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50">
            {responsibleOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Resolution">
            <select value={form.customerResolution}
              onChange={e => onChange({ ...form, customerResolution: e.target.value })}
              disabled={!canResolve}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50">
              {resolutionOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Staff Action">
            <select value={form.staffAction}
              onChange={e => onChange({ ...form, staffAction: e.target.value })}
              disabled={!canAction}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50">
              {staffActionOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Resolution Notes">
          <textarea value={form.resolutionNotes || ''}
            onChange={e => onChange({ ...form, resolutionNotes: e.target.value })}
            placeholder="Notes about the resolution process..."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
        </Field>

        <Field label="Recorded By">
          <select value={form.recordedBy || form.createdBy}
            onChange={e => onChange({ ...form, recordedBy: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            {creatorOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        {canDelete && onDelete && (
          <button
            onClick={() => { if (window.confirm('Delete this complaint?')) onDelete() }}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-red-500 border border-red-200 active:bg-red-50 transition-colors">
            Delete Complaint
          </button>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
