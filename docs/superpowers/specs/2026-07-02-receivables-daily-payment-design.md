# Receivables Daily Payment Confirmation

## Goal

Allow authorized staff to settle all delivered, unpaid Bento orders for one customer on one date from the Receivables customer detail sheet.

## User Experience

- Each date group in the Bento receivable detail sheet has one orange `Confirm payment` button beside the date total.
- Tapping the button opens an in-app confirmation dialog showing the customer, date, number of orders, and total amount.
- Confirming disables repeated submission and shows a processing state.
- On success, that date group disappears immediately. The customer balance, Receivables total, and outstanding count refresh. If no unpaid dates remain, the customer detail closes.
- Cancelling closes the confirmation dialog without changing data.
- On failure, the date group remains visible and an error message is shown.

## Data Rules

- Only order IDs already present in the selected customer/date group are updated.
- Every selected order is written with `paid: true`, `payment_status: 'paid'`, and `amount_paid` equal to that order's amount.
- Orders from another customer or date are never included.
- The existing Receivables access rules remain unchanged. The action is available only when the page reports write access.

## Implementation Shape

- Reuse the existing date grouping in `ReceivablesClient`.
- Extract the paid-update payload into a small pure helper so its scope and values can be regression tested.
- Add local state for the pending date group, submission state, and errors.
- Use the existing Supabase browser client for the same Bento payment update already used by the Unpaid Orders page.

## Verification

- A unit regression test proves a date group produces updates for exactly its own order IDs and amounts.
- A source-level UI regression test checks that each date group exposes the accessible confirmation control and dialog.
- Run the focused tests, ESLint for changed files, and TypeScript type checking.
