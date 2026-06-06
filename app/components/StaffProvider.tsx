'use client'

import { createContext, useContext } from 'react'
import type { CurrentStaff } from '@/lib/auth/types'

const StaffContext = createContext<CurrentStaff | null>(null)

export default function StaffProvider({
  staff,
  children,
}: {
  staff: CurrentStaff | null
  children: React.ReactNode
}) {
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>
}

export function useStaff() {
  return useContext(StaffContext)
}
