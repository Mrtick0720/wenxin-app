export function projectAcceptedVerification<T extends Record<string, unknown>>(
  record: T,
  input: {
    businessDate: string
    verifiedByName: string
    verifiedAt: string
    receivedQuantity: number
  },
) {
  return {
    ...record,
    date: input.businessDate,
    status: 'verified' as const,
    verified_by_name: input.verifiedByName,
    verified_at: input.verifiedAt,
    received_quantity: input.receivedQuantity,
  }
}
