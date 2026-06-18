'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/currentStaff'
import { sanitizeAuditData } from '@/lib/auth/audit'
import {
  isStaffRole,
  normalizeStaffId,
  staffIdToEmail,
  validateNewStaff,
  validatePasswordChange,
} from '@/lib/auth/permissions'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type AccountActionState = {
  error: string
  success: string
}

const emptyState: AccountActionState = { error: '', success: '' }

async function writeAccountAudit(input: {
  actorId: string
  actorStaffId: string
  action: string
  targetId: string
  summary: string
  before?: unknown
  after?: unknown
}) {
  const admin = createAdminSupabaseClient()
  await admin.from('audit_logs').insert({
    actor_user_id: input.actorId,
    actor_staff_id: input.actorStaffId,
    action: input.action,
    entity_type: 'staff_profile',
    entity_id: input.targetId,
    summary: input.summary,
    before_data: input.before ? sanitizeAuditData(input.before) : null,
    after_data: input.after ? sanitizeAuditData(input.after) : null,
  })
}

export async function createStaffAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const owner = await requireRole('owner')
  const staffId = normalizeStaffId(String(formData.get('staffId') ?? ''))
  const displayName = String(formData.get('displayName') ?? '').trim()
  const role = String(formData.get('role') ?? '')
  const password = String(formData.get('password') ?? '')
  const validation = validateNewStaff({ staffId, displayName, role, password })

  if (!validation.ok) return { ...emptyState, error: validation.error }

  const admin = createAdminSupabaseClient()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: staffIdToEmail(staffId),
    password,
    email_confirm: true,
    app_metadata: { staff_id: staffId },
  })

  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes('already')
    return {
      ...emptyState,
      error: duplicate ? 'This Staff ID is already in use.' : 'Unable to create this account.',
    }
  }

  const { error: profileError } = await admin.from('staff_profiles').insert({
    id: created.user.id,
    staff_id: staffId,
    display_name: displayName,
    role,
    active: true,
    archived: false,
    must_change_password: true,
    password_change_required_at: new Date().toISOString(),
    created_by: owner.id,
  })

  if (profileError) {
    console.error('[createStaffAction] profile insert failed:', profileError)
    await admin.auth.admin.deleteUser(created.user.id)
    const msg = profileError.message ?? ''
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { ...emptyState, error: 'Staff ID already exists.' }
    }
    return { ...emptyState, error: `Unable to finish creating this account. (${msg})` }
  }

  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'account_created',
    targetId: created.user.id,
    summary: `Created staff account ${staffId}`,
    after: { staff_id: staffId, display_name: displayName, role, active: true },
  })

  revalidatePath('/staff/accounts')
  return { error: '', success: `${displayName} was created.` }
}

export async function suspendStaffAction(formData: FormData) {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  if (!targetId || targetId === owner.id) return

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()
  await admin.from('staff_profiles').update({ active: false }).eq('id', targetId)

  const supabase = await createServerSupabaseClient()
  await supabase.rpc('invalidate_staff_sessions', {
    target_user: targetId,
    reason: 'suspended',
  })

  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'account_suspended',
    targetId,
    summary: `Suspended ${before?.staff_id ?? 'staff account'}`,
    before,
    after: before ? { ...before, active: false } : { active: false },
  })
  revalidatePath('/staff/accounts')
}

export async function reactivateStaffAction(formData: FormData) {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  if (!targetId) return

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()
  await admin.from('staff_profiles').update({ active: true, archived: false, archive_date: null, archive_reason: null, archived_by: null }).eq('id', targetId)
  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'account_reactivated',
    targetId,
    summary: `Reactivated ${before?.staff_id ?? 'staff account'}`,
    before,
    after: before ? { ...before, active: true, archived: false } : { active: true, archived: false },
  })
  revalidatePath('/staff/accounts')
}

export async function archiveStaffAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!targetId || targetId === owner.id) return { ...emptyState, error: 'Cannot archive this account.' }
  if (!reason) return { ...emptyState, error: 'Select an archive reason.' }

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()

  await admin.from('staff_profiles').update({
    active: false,
    archived: true,
    archive_date: new Date().toISOString(),
    archive_reason: reason,
    archived_by: owner.id,
  }).eq('id', targetId)

  const supabase = await createServerSupabaseClient()
  await supabase.rpc('invalidate_staff_sessions', {
    target_user: targetId,
    reason: 'archived',
  })

  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'account_archived',
    targetId,
    summary: `Archived ${before?.staff_id ?? 'staff account'} — ${reason}`,
    before,
    after: { active: false, archived: true, archive_reason: reason },
  })
  revalidatePath('/staff/accounts')
  return { error: '', success: `${before?.display_name ?? 'Account'} was archived.` }
}

export async function restoreStaffAction(formData: FormData) {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  if (!targetId) return

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()

  await admin.from('staff_profiles').update({
    active: true,
    archived: false,
    archive_date: null,
    archive_reason: null,
    archived_by: null,
  }).eq('id', targetId)

  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'account_restored',
    targetId,
    summary: `Restored ${before?.staff_id ?? 'staff account'} from archive`,
    before,
    after: { active: true, archived: false },
  })
  revalidatePath('/staff/accounts')
}

export async function forceLogoutStaffAction(formData: FormData) {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  if (!targetId || targetId === owner.id) return

  const supabase = await createServerSupabaseClient()
  await supabase.rpc('invalidate_staff_sessions', {
    target_user: targetId,
    reason: 'forced',
  })
  revalidatePath('/staff/accounts')
}

export async function resetStaffPasswordAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  const validation = validatePasswordChange(password, confirmation)

  if (!targetId) return { ...emptyState, error: 'Select a staff account.' }
  if (!validation.ok) return { ...emptyState, error: validation.error }

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()
  const { error: passwordError } = await admin.auth.admin.updateUserById(targetId, { password })
  if (passwordError) return { ...emptyState, error: 'Unable to reset this password.' }

  await admin
    .from('staff_profiles')
    .update({
      must_change_password: true,
      password_change_required_at: new Date().toISOString(),
    })
    .eq('id', targetId)

  const supabase = await createServerSupabaseClient()
  await supabase.rpc('invalidate_staff_sessions', {
    target_user: targetId,
    reason: 'forced',
  })

  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'password_reset',
    targetId,
    summary: `Reset password for ${before?.staff_id ?? 'staff account'}`,
  })
  revalidatePath('/staff/accounts')
  return { error: '', success: 'Temporary password was reset.' }
}

export async function changeStaffRoleAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  const role = String(formData.get('role') ?? '')
  if (!targetId || targetId === owner.id) return { ...emptyState, error: 'Cannot change this account.' }
  if (!isStaffRole(role)) return { ...emptyState, error: `Invalid role: ${role}` }

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()
  const { error: updateError } = await admin.from('staff_profiles').update({ role }).eq('id', targetId)
  if (updateError) return { ...emptyState, error: `Failed to update role: ${updateError.message}` }

  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'role_changed',
    targetId,
    summary: `Changed ${before?.staff_id ?? 'staff account'} role to ${role}`,
    before: before ? { role: before.role } : null,
    after: { role },
  })
  revalidatePath('/staff/accounts')
  return { error: '', success: `Role updated to ${role.replace('_', ' ')}.` }
}
