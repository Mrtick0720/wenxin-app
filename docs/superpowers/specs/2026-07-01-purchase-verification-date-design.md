# Purchase Verification Date Design

## Goal

When a purchase remains in **To Verify** across business days, accepting it records the purchase against the business day on which verification is performed.

## Behaviour

- The original submission timestamp remains available in `created_at` for audit history.
- `acceptVerificationAction` obtains the current Kota Kinabalu business date from the existing `businessToday()` helper and writes it to `purchase_items.date` in the same guarded update that changes the status to `verified`.
- The action response includes the new date so the optimistic Received row, daily summary, monthly KPI, and later server refresh all agree immediately.
- Rejecting or returning a purchase does not change its date.
- Same-day verification remains unchanged because the assigned date is already today.

## Permissions and errors

The existing verification role checks and `status = 'pending_verification'` concurrency guard remain intact. The existing prior-day RLS migration continues to permit kitchen and front-desk verification; no new database column or policy is needed.

## Testing

A pure helper will define the verified record projection. A regression test will prove that a prior-day record receives the supplied business date while preserving `created_at`, and that verification audit fields and received quantity are applied. The purchase ledger test suite and TypeScript compiler will then be run.
