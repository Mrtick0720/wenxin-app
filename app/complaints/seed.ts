import type { Complaint } from './types'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export const seedComplaints: Complaint[] = [
  {
    id: 1, complaintId: 'CMP-20260607-001', customer: 'Walk-in Guest', type: 'Food Quality',
    description: 'Soup was cold when served', severity: 'medium', status: 'open',
    time: '12:15', date: daysAgo(0),
    complaintMethod: 'On-site Quality Issue', responsiblePerson: 'Kitchen Staff',
    reportedBy: 'Walk-in Guest', recordedBy: 'Front Desk Staff', closedBy: '',
    customerResolution: 'Pending', staffAction: 'Pending', resolutionNotes: '',
    orderId: '', reservationId: '', tableNo: '5', createdBy: 'Front Desk Staff', archivedAt: null,
  },
  {
    id: 2, complaintId: 'CMP-20260607-002', customer: 'Bento Order #42', type: 'Delivery',
    description: 'Order arrived 30 minutes late', severity: 'high', status: 'handling',
    time: '12:40', date: daysAgo(0),
    complaintMethod: 'Foodpanda', responsiblePerson: 'Delivery Staff',
    reportedBy: 'Customer Service', recordedBy: 'Customer Service', closedBy: '',
    customerResolution: 'Apology', staffAction: 'Verbal Reminder', resolutionNotes: 'Customer accepted apology. Refund processed via Foodpanda.',
    orderId: 'B42', reservationId: '', tableNo: '', createdBy: 'Customer Service', archivedAt: null,
  },
  {
    id: 3, complaintId: 'CMP-20260607-003', customer: 'Table 3 Guest', type: 'Service',
    description: 'Waited 20 min for menu', severity: 'low', status: 'resolved',
    time: '13:10', date: daysAgo(0),
    complaintMethod: 'On-site Quality Issue', responsiblePerson: 'Service Staff',
    reportedBy: 'Table 3 Guest', recordedBy: 'Shift Supervisor', closedBy: 'Shift Supervisor',
    customerResolution: 'Discount', staffAction: 'Training', resolutionNotes: '10% discount applied. Staff retrained on greeting protocol.',
    orderId: '', reservationId: '', tableNo: '3', createdBy: 'Shift Supervisor', archivedAt: null,
  },
  {
    id: 4, complaintId: 'CMP-20260606-001', customer: 'Google Reviewer', type: 'Cleanliness',
    description: 'Found hair in claypot rice', severity: 'high', status: 'closed',
    time: '19:30', date: daysAgo(1),
    complaintMethod: 'Google Review', responsiblePerson: 'Kitchen Staff',
    reportedBy: 'Customer Service', recordedBy: 'Customer Service', closedBy: 'Store Manager',
    customerResolution: 'Refund', staffAction: 'Point Deduction', resolutionNotes: 'Full refund given. Kitchen staff docked points. Reply posted on Google.',
    orderId: '', reservationId: '', tableNo: '8', createdBy: 'Customer Service', archivedAt: null,
  },
  {
    id: 5, complaintId: 'CMP-20260605-001', customer: 'GrabFood Customer', type: 'Delivery',
    description: 'Missing items in order', severity: 'medium', status: 'closed',
    time: '20:00', date: daysAgo(2),
    complaintMethod: 'GrabFood', responsiblePerson: 'Delivery Staff',
    reportedBy: 'Customer Service', recordedBy: 'Customer Service', closedBy: 'Store Manager',
    customerResolution: 'Remake', staffAction: 'Written Warning', resolutionNotes: 'Order remade and sent. Written warning issued.',
    orderId: 'GF-8891', reservationId: '', tableNo: '', createdBy: 'Customer Service', archivedAt: daysAgo(32),
  },
  {
    id: 6, complaintId: 'CMP-20260604-001', customer: 'Table 12 Guest', type: 'Food Quality',
    description: 'Dish too salty', severity: 'low', status: 'closed',
    time: '13:00', date: daysAgo(3),
    complaintMethod: 'On-site Quality Issue', responsiblePerson: 'Kitchen Staff',
    reportedBy: 'Table 12 Guest', recordedBy: 'Front Desk Staff', closedBy: 'Shift Supervisor',
    customerResolution: 'Remake', staffAction: 'No Penalty', resolutionNotes: 'Dish remade immediately. One-off issue.',
    orderId: '', reservationId: '', tableNo: '12', createdBy: 'Front Desk Staff', archivedAt: daysAgo(33),
  },
]

export function emptyComplaint(nextId: number): Complaint {
  const today = new Date()
  return {
    id: nextId,
    complaintId: `CMP-${today.toISOString().split('T')[0].replace(/-/g,'')}-${String(nextId).padStart(3,'0')}`,
    customer: '',
    type: 'Service',
    description: '',
    severity: 'low',
    status: 'open',
    time: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: daysAgo(0),
    complaintMethod: 'On-site Quality Issue',
    responsiblePerson: 'Unknown',
    reportedBy: '',
    recordedBy: '',
    closedBy: '',
    customerResolution: 'Pending',
    staffAction: 'Pending',
    resolutionNotes: '',
    orderId: '',
    reservationId: '',
    tableNo: '',
    createdBy: 'Front Desk Staff',
    archivedAt: null,
  }
}
