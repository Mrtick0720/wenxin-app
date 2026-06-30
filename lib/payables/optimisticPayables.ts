type PayableLike = { id: number }

export function reconcilePayablesAfterFetch<T extends PayableLike>(
  fetchedItems: T[],
  pendingPaidIds: ReadonlySet<number>,
): { items: T[]; pendingPaidIds: Set<number> } {
  if (pendingPaidIds.size === 0) {
    return { items: fetchedItems, pendingPaidIds: new Set() }
  }

  const fetchedIds = new Set(fetchedItems.map((item) => item.id))
  const stillPending = new Set<number>()

  for (const id of pendingPaidIds) {
    if (fetchedIds.has(id)) stillPending.add(id)
  }

  return {
    items: fetchedItems.filter((item) => !stillPending.has(item.id)),
    pendingPaidIds: stillPending,
  }
}
