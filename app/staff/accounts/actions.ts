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

  const profile = {
    id: created.user.id,
    staff_id: staffId,
    display_name: displayName,
    role,
    active: true,
    must_change_password: true,
    password_change_required_at: new Date().toISOString(),
    created_by: owner.id,
  }
  const { error: profileError } = await admin.from('staff_profiles').insert(profile)

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { ...emptyState, error: 'Unable to finish creating this account.' }
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
  await admin.from('staff_profiles').update({ active: true }).eq('id', targetId)
  await writeAccountAudit({
    actorId: owner.id,
    actorStaffId: owner.staffId,
    action: 'account_reactivated',
    targetId,
    summary: `Reactivated ${before?.staff_id ?? 'staff account'}`,
    before,
    after: before ? { ...before, active: true } : { active: true },
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

export async function changeStaffRoleAction(formData: FormData) {
  const owner = await requireRole('owner')
  const targetId = String(formData.get('targetId') ?? '')
  const role = String(formData.get('role') ?? '')
  if (!targetId || targetId === owner.id || !isStaffRole(role)) return

  const admin = createAdminSupabaseClient()
  const { data: before } = await admin.from('staff_profiles').select('*').eq('id', targetId).single()
  await admin.from('staff_profiles').update({ role }).eq('id', targetId)

  const supabase = await createServerSupabaseClient()
  await supabase.rpc('invalidate_staff_sessions', {
    target_user: targetId,
    reason: 'forced',
  })

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
}
