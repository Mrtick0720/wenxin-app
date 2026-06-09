// ── Checklist Domain Types ──
// Approved entities from the Checklist module architecture.

export type ChecklistType =
  | 'opening' | 'closing' | 'kitchen_hygiene' | 'stock_check' | 'cash_closing'

export type ChecklistInstanceStatus =
  | 'pending' | 'in_progress' | 'completed' | 'verified'

export type ChecklistItemStatus =
  | 'pending' | 'pass' | 'fail' | 'skip'

export type ChecklistTemplate = {
  id: number
  outletId: string
  name: string
  checklistType: ChecklistType
  description: string
  assignedRole: string
  isRecurring: boolean
  requiresVerification: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ChecklistTemplateRun = {
  id: number
  templateId: number
  runKey: string
  scheduledTime: string  // time only, e.g. "08:00"
  createdAt: string
}

export type ChecklistTemplateItem = {
  id: number
  templateId: number
  description: string
  category: string
  sortOrder: number
  isCritical: boolean
  requiresNoteOnFail: boolean
  inventoryRef: string | null
  createdAt: string
  updatedAt: string
}

export type ChecklistInstance = {
  id: number
  templateId: number
  outletId: string
  runKey: string
  businessDate: string
  scheduledTime: string
  status: ChecklistInstanceStatus
  assignedRole: string
  completedBy: string | null
  startedAt: string | null
  completedAt: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  verificationNote: string | null
  rejectionNote: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type ChecklistItemResponse = {
  id: number
  instanceId: number
  templateItemId: number
  status: ChecklistItemStatus
  note: string | null
  respondedBy: string | null
  respondedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ChecklistAction =
  | 'view_own'
  | 'view_all'
  | 'respond'
  | 'verify'
  | 'manage_templates'
