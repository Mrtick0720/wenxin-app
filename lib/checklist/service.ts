// ── Checklist Service Layer ──
// Business logic for checklist operations.
// Phase 1: Template queries, instance scheduling, board display.
// Completion/verification workflow comes in Phase 2.

import {
  findTemplates,
  findTemplateById,
  findRunsByTemplate,
  findTemplateItems,
  findInstancesByDate,
  findInstanceById,
  findItemResponses,
  scheduleDailyChecklists,
  updateInstance,
  upsertItemResponse,
  insertIncident,
  insertTask,
} from './repository'
import {
  isOverdue,
  complianceScore,
  canCompleteInstance,
  canVerifyInstance,
  canRejectInstance,
  validateFailedItemNote,
  validateRejectionReason,
  isValidResponseStatus,
} from './validation'
import type {
  ChecklistTemplate,
  ChecklistTemplateRun,
  ChecklistTemplateItem,
  ChecklistInstance,
  ChecklistItemResponse,
} from './types'

const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000001'

// ═══════════════════════════════════════════════════════════════════
// Template Queries
// ═══════════════════════════════════════════════════════════════════

export async function getChecklistTemplates(): Promise<ChecklistTemplate[]> {
  return findTemplates()
}

export async function getTemplateById(
  templateId: number,
): Promise<ChecklistTemplate | null> {
  return findTemplateById(templateId)
}

export async function getTemplateWithDetails(
  templateId: number,
): Promise<{
  template: ChecklistTemplate
  runs: ChecklistTemplateRun[]
  items: ChecklistTemplateItem[]
} | null> {
  const template = await findTemplateById(templateId)
  if (!template) return null

  const [runs, items] = await Promise.all([
    findRunsByTemplate(templateId),
    findTemplateItems(templateId),
  ])

  return { template, runs, items }
}

// ═══════════════════════════════════════════════════════════════════
// Instance Scheduling
// ═══════════════════════════════════════════════════════════════════

export async function createDailyInstances(
  businessDate?: string,
): Promise<ChecklistInstance[]> {
  const today = businessDate ?? new Date().toISOString().split('T')[0]
  return scheduleDailyChecklists(today)
}

// ═══════════════════════════════════════════════════════════════════
// Instance Queries
// ═══════════════════════════════════════════════════════════════════

export async function getChecklistInstance(
  instanceId: number,
): Promise<{
  instance: ChecklistInstance
  template: ChecklistTemplate
  items: ChecklistTemplateItem[]
  responses: ChecklistItemResponse[]
} | null> {
  const instance = await findInstanceById(instanceId)
  if (!instance) return null

  const [template, items, responses] = await Promise.all([
    findTemplateById(instance.templateId),
    findTemplateItems(instance.templateId),
    findItemResponses(instanceId),
  ])

  if (!template) return null

  return { instance, template, items, responses }
}

// ═══════════════════════════════════════════════════════════════════
// Today's Board
// ═══════════════════════════════════════════════════════════════════

export type ChecklistBoardEntry = {
  instance: ChecklistInstance
  template: ChecklistTemplate
  run: ChecklistTemplateRun | null
  responses: ChecklistItemResponse[]
  totalItems: number
  respondedCount: number
  isOverdue: boolean
  complianceScore: number
}

export async function getChecklistBoard(
  role: string,
): Promise<{
  board: ChecklistBoardEntry[]
  templates: ChecklistTemplate[]
}> {
  const today = new Date().toISOString().split('T')[0]

  // Ensure today's instances exist
  await scheduleDailyChecklists(today)

  // Fetch
  const [templates, instances] = await Promise.all([
    findTemplates(),
    findInstancesByDate(today, DEFAULT_OUTLET_ID),
  ])

  // Filter instances by role
  const visibleInstances = instances.filter(i =>
    role === 'owner' || role === 'manager' || i.assignedRole === role
  )

  // Build board entries
  const board: ChecklistBoardEntry[] = []
  for (const instance of visibleInstances) {
    const template = templates.find(t => t.id === instance.templateId)
    if (!template) continue

    const [runs, responses] = await Promise.all([
      findRunsByTemplate(template.id),
      findItemResponses(instance.id),
    ])

    const run = runs.find(r => r.runKey === instance.runKey) ?? null

    board.push({
      instance,
      template,
      run,
      responses,
      totalItems: responses.length,
      respondedCount: responses.filter(r => r.status !== 'pending').length,
      isOverdue: isOverdue(instance),
      complianceScore: complianceScore(responses),
    })
  }

  // Sort: overdue first, then by status (pending → in_progress → completed → verified)
  board.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    const order = { pending: 0, in_progress: 1, completed: 2, verified: 3 }
    return (order[a.instance.status] ?? 99) - (order[b.instance.status] ?? 99)
  })

  return { board, templates }
}

// ═══════════════════════════════════════════════════════════════════
// Item Response (Phase 2)
// ═══════════════════════════════════════════════════════════════════

export async function respondToItem(
  instanceId: number,
  templateItemId: number,
  status: string,
  note: string | null,
  staffUserId: string,
  staffRole: string,
): Promise<ChecklistItemResponse> {
  if (!isValidResponseStatus(status)) {
    throw new Error(`Invalid response status: "${status}". Use pass, fail, or skip.`)
  }

  const instance = await findInstanceById(instanceId)
  if (!instance) throw new Error('Checklist instance not found.')

  const { canRespondToItem } = await import('./validation')
  if (!canRespondToItem(instance, staffRole)) {
    throw new Error('You cannot respond to this checklist. It may already be completed or assigned to a different role.')
  }

  // Validate note on fail
  if (status === 'fail') {
    const items = await findTemplateItems(instance.templateId)
    const item = items.find(i => i.id === templateItemId)
    if (item && !validateFailedItemNote(note, item.requiresNoteOnFail)) {
      throw new Error('A note is required when marking an item as failed.')
    }
  }

  // Validate note on skip
  if (status === 'skip' && !note?.trim()) {
    throw new Error('A note is required when marking an item as not applicable.')
  }

  // Mark instance as in_progress if currently pending
  if (instance.status === 'pending') {
    await updateInstance(instanceId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      completedBy: staffUserId,
    })
  }

  return upsertItemResponse({
    instanceId,
    templateItemId,
    status,
    note,
    respondedBy: staffUserId,
  })
}

// ═══════════════════════════════════════════════════════════════════
// Complete Checklist (Phase 2)
// ═══════════════════════════════════════════════════════════════════

export async function completeChecklist(
  instanceId: number,
  staffUserId: string,
): Promise<ChecklistInstance> {
  const instance = await findInstanceById(instanceId)
  if (!instance) throw new Error('Checklist instance not found.')

  if (instance.status !== 'in_progress') {
    throw new Error(`Cannot complete a checklist with status "${instance.status}". Must be in progress.`)
  }

  const responses = await findItemResponses(instanceId)
  if (!canCompleteInstance(responses)) {
    throw new Error('All items must be responded to before completing the checklist.')
  }

  const now = new Date().toISOString()
  const updated = await updateInstance(instanceId, {
    status: 'completed',
    completedAt: now,
    completedBy: staffUserId,
  })

  // Generate follow-ups for failed items
  const template = await findTemplateById(instance.templateId)
  const items = await findTemplateItems(instance.templateId)
  const today = new Date().toISOString().split('T')[0]

  for (const response of responses) {
    if (response.status !== 'fail') continue

    const item = items.find(i => i.id === response.templateItemId)
    if (!item) continue

    await generateFollowUpForFailedItem(
      instance, item, response, template?.name ?? 'Checklist', today,
    )
  }

  return updated
}

// ═══════════════════════════════════════════════════════════════════
// Verification (Phase 2)
// ═══════════════════════════════════════════════════════════════════

export async function verifyChecklist(
  instanceId: number,
  staffUserId: string,
  note?: string,
): Promise<ChecklistInstance> {
  const instance = await findInstanceById(instanceId)
  if (!instance) throw new Error('Checklist instance not found.')

  if (!canVerifyInstance(instance)) {
    throw new Error(`Cannot verify a checklist with status "${instance.status}". Must be completed.`)
  }

  return updateInstance(instanceId, {
    status: 'verified',
    verifiedBy: staffUserId,
    verifiedAt: new Date().toISOString(),
    verificationNote: note || undefined,
  })
}

export async function rejectChecklist(
  instanceId: number,
  staffUserId: string,
  reason: string,
): Promise<ChecklistInstance> {
  const instance = await findInstanceById(instanceId)
  if (!instance) throw new Error('Checklist instance not found.')

  if (!canRejectInstance(instance)) {
    throw new Error(`Cannot reject a checklist with status "${instance.status}". Must be completed.`)
  }

  if (!validateRejectionReason(reason)) {
    throw new Error('A reason is required to reject a checklist.')
  }

  return updateInstance(instanceId, {
    status: 'in_progress',
    rejectionNote: reason.trim(),
  })
}

// ═══════════════════════════════════════════════════════════════════
// Failed Item Follow-Up (Phase 2)
// ═══════════════════════════════════════════════════════════════════

export async function generateFollowUpForFailedItem(
  instance: ChecklistInstance,
  item: ChecklistTemplateItem,
  response: ChecklistItemResponse,
  checklistName: string,
  businessDate: string,
): Promise<void> {
  if (item.isCritical) {
    // Critical → Incident
    await insertIncident({
      date: businessDate,
      title: `Checklist Failure: ${checklistName} — ${item.description}`,
      incidentType: 'checklist',
      severity: 'high',
      status: 'open',
      checklistInstanceId: instance.id,
      reportedBy: instance.completedBy,
    })
  } else {
    // Non-critical → Task
    await insertTask({
      date: businessDate,
      title: `Checklist Follow-up: ${item.description}`,
      taskType: 'checklist',
      priority: 'medium',
      status: 'pending',
      checklistInstanceId: instance.id,
      assignedRole: instance.assignedRole,
    })
  }
}

// ═══════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  isInstanceComplete,
  isOverdue,
  complianceScore,
  isValidStatusTransition,
  isResponseNoteRequired,
  isValidRunKey,
  canRespondToItem,
  canCompleteInstance,
  canVerifyInstance,
  canRejectInstance,
  validateFailedItemNote,
  validateRejectionReason,
  isValidResponseStatus,
} from './validation'
