export type ProductionOrderSnapshot = {
  id: number
  date: string
  status?: string | null
  [key: string]: unknown
}

export type BentoOrderUpdatedDetail<T extends ProductionOrderSnapshot = ProductionOrderSnapshot> = {
  date?: string
  dates?: string[]
  order?: T
}

export function applyProductionOrderUpdate<T extends ProductionOrderSnapshot>(
  current: T[],
  selectedDate: string,
  detail?: BentoOrderUpdatedDetail<T>,
): T[] {
  const savedOrder = detail?.order
  if (!savedOrder) return current

  const existing = current.find(order => order.id === savedOrder.id)
  const merged = existing ? { ...existing, ...savedOrder } : savedOrder
  const withoutSavedOrder = current.filter(order => order.id !== savedOrder.id)

  if (merged.date !== selectedDate || merged.status === 'canceled') {
    return withoutSavedOrder
  }

  return [...withoutSavedOrder, merged].sort((a, b) => a.id - b.id)
}
