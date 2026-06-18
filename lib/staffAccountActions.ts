export type StaffAccountStatus = 'active' | 'suspended' | 'archived'

export type StaffAccountActionKey =
  | 'reset-password'
  | 'force-logout'
  | 'suspend'
  | 'reactivate'
  | 'archive'
  | 'restore'

export function getStaffAccountActionKeys({
  isOwner,
  status,
  sessionActive,
}: {
  isOwner: boolean
  status: StaffAccountStatus
  sessionActive: boolean
}): StaffAccountActionKey[] {
  if (isOwner) return []

  if (status === 'active') {
    return [
      'reset-password',
      ...(sessionActive ? ['force-logout' as const] : []),
      'suspend',
      'archive',
    ]
  }

  if (status === 'suspended') {
    return ['reactivate', 'archive']
  }

  return ['restore']
}
