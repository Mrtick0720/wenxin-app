export function getCustomerDetailInitialState<T>(initialCustomer?: T | null) {
  return {
    customer: initialCustomer ?? null,
    loading: !initialCustomer,
  }
}
