// Create (or reset) a test staff account. Mirrors scripts/create-owner.mjs.
// Does NOT change schema — only creates an auth user + staff_profiles row.
//
// Usage:
//   npx tsx scripts/create-test-staff.mjs <staffId> "<Display Name>" <role> <password>
//   role: kitchen | manager | front_desk | owner
//
// Idempotent: if the account already exists, its password is reset and the
// profile is updated. Test accounts are created with must_change_password=false.

import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { isValidStaffId, normalizeStaffId, staffIdToEmail } from '../lib/auth/permissions.ts'

process.loadEnvFile(resolve(process.cwd(), '.env.local'))

const [, , rawId, rawName, rawRole, rawPass] = process.argv
if (!rawId || !rawName || !rawRole || !rawPass) {
  console.error('Usage: npx tsx scripts/create-test-staff.mjs <staffId> "<Display Name>" <role> <password>')
  console.error('  role: kitchen | manager | front_desk | owner')
  process.exit(1)
}

const staffId = normalizeStaffId(rawId)
const displayName = rawName.trim()
const role = rawRole.trim()
const password = rawPass
const ALLOWED = ['owner', 'manager', 'kitchen', 'front_desk']

if (!isValidStaffId(staffId)) { console.error('Invalid staffId (3-32 lowercase letters/numbers/._-).'); process.exit(1) }
if (!displayName) { console.error('Display name required.'); process.exit(1) }
if (!ALLOWED.includes(role)) { console.error(`Role must be one of: ${ALLOWED.join(', ')}`); process.exit(1) }
if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1) }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const email = staffIdToEmail(staffId)

let userId
const { data: created } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, app_metadata: { staff_id: staffId },
})
if (created?.user) {
  userId = created.user.id
} else {
  // Already exists → find and reset password.
  let found
  for (let page = 1; page <= 20 && !found; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users?.length) break
    found = data.users.find((u) => u.email === email)
  }
  if (!found) { console.error('Could not create or locate the auth user.'); process.exit(1) }
  userId = found.id
  await admin.auth.admin.updateUserById(userId, { password })
}

const { error: profileError } = await admin.from('staff_profiles').upsert({
  id: userId,
  staff_id: staffId,
  display_name: displayName,
  role,
  active: true,
  must_change_password: false,
  password_change_required_at: new Date().toISOString(),
}, { onConflict: 'id' })

if (profileError) { console.error(`Profile error: ${profileError.message}`); process.exit(1) }

console.log(`✅ ${role} account ready`)
console.log(`   Staff ID: ${staffId}`)
console.log(`   Password: ${password}`)
