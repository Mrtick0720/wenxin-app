export const STAFF_ROLES = ['owner', 'manager', 'kitchen', 'front_desk', 'delivery'] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export type StaffProfile = {
  id: string
  staff_id: string
  display_name: string
  role: StaffRole
  active: boolean
  must_change_password: boolean
  sessions_invalidated_at: string | null
  last_login_at: string | null
}

export type CurrentStaff = {
  id: string
  staffId: string
  displayName: string
  role: StaffRole
  mustChangePassword: boolean
  expiresAt: string
}

export type NavigationItem = {
  href: string
  label: string
}
