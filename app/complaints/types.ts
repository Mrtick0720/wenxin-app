export interface Complaint {
  id: number
  complaintId: string
  customer: string
  type: string
  description: string
  severity: string
  status: string
  time: string
  date: string
  complaintMethod: string
  responsiblePerson: string
  reportedBy: string
  recordedBy: string
  closedBy: string
  customerResolution: string
  staffAction: string
  resolutionNotes: string
  orderId: string
  reservationId: string
  tableNo: string
  createdBy: string
  archivedAt: string | null
}

export type StaffRole = 'owner' | 'manager' | 'supervisor' | 'front_desk' | 'customer_service' | 'service_staff' | 'kitchen' | null | undefined

export function canEditComplaint(role: StaffRole, createdBy: string): boolean {
  if (role === 'owner' || role === 'manager' || role === 'supervisor') return true
  if (createdBy === 'Front Desk Staff' && role === 'front_desk') return true
  if (createdBy === 'Service Staff' && role === 'service_staff') return true
  if (createdBy === 'Customer Service' && role === 'customer_service') return true
  return false
}

export function canCloseComplaint(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'supervisor'
}

export function canAssignResolution(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'supervisor'
}

export function canAssignStaffAction(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager'
}

export const severityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
  medium: { label: 'Normal', color: 'bg-orange-100 text-orange-600' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-500' },
}

export const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-red-500' },
  handling: { label: 'Handling', color: 'text-orange-500' },
  resolved: { label: 'Resolved', color: 'text-green-500' },
  closed: { label: 'Closed', color: 'text-gray-400' },
}

export const methodLabel: Record<string, string> = {
  'On-site Complaint': 'On-site',
  'Google Review': 'Google',
  'Foodpanda': 'Foodpanda',
  'GrabFood': 'Grab',
  'Facebook': 'Facebook',
  'Online Platform Complaint': 'Online',
  'Reported Complaint': 'Reported',
  'Other': 'Other',
}

export const timelineLabels: Record<string, string> = {
  open: 'Complaint Received',
  handling: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}
