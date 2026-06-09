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
} from './repository'
import {
  isOverdue,
  complianceScore,
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
// Re-exports
// ═══════════════════════════════════════════════════════════════════

export {
  isInstanceComplete,
  isOverdue,
  complianceScore,
  isValidStatusTransition,
  isResponseNoteRequired,
  isValidRunKey,
} from './validation'
