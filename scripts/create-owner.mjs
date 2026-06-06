import { createClient } from '@supabase/supabase-js'
import {
  isValidStaffId,
  normalizeStaffId,
  staffIdToEmail,
} from '../lib/auth/permissions.ts'

const requiredNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OWNER_STAFF_ID',
  'OWNER_DISPLAY_NAME',
  'OWNER_INITIAL_PASSWORD',
]

const missing = requiredNames.filter(name => !process.env[name])
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const staffId = normalizeStaffId(process.env.OWNER_STAFF_ID)
const displayName = process.env.OWNER_DISPLAY_NAME.trim()
const password = process.env.OWNER_INITIAL_PASSWORD

if (!isValidStaffId(staffId)) {
  throw new Error('OWNER_STAFF_ID must use 3-32 lowercase letters, numbers, dots, underscores, or hyphens.')
}
if (!displayName) {
  throw new Error('OWNER_DISPLAY_NAME is required.')
}
if (password.length < 8) {
  throw new Error('OWNER_INITIAL_PASSWORD must be at least 8 characters.')
}

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const { count, error: ownerCheckError } = await admin
  .from('staff_profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'owner')

if (ownerCheckError) {
  throw new Error(`Unable to check Owner accounts: ${ownerCheckError.message}`)
}
if ((count ?? 0) > 0) {
  throw new Error('An Owner account already exists. Bootstrap stopped.')
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: staffIdToEmail(staffId),
  password,
  email_confirm: true,
  app_metadata: { staff_id: staffId },
})

if (createError || !created.user) {
  throw new Error(`Unable to create Owner: ${createError?.message ?? 'Unknown error'}`)
}

const { error: profileError } = await admin.from('staff_profiles').insert({
  id: created.user.id,
  staff_id: staffId,
  display_name: displayName,
  role: 'owner',
  active: true,
  must_change_password: true,
  password_change_required_at: new Date().toISOString(),
})

if (profileError) {
  await admin.auth.admin.deleteUser(created.user.id)
  throw new Error(`Unable to create Owner profile: ${profileError.message}`)
}

console.log(`Owner account created for Staff ID: ${staffId}`)
