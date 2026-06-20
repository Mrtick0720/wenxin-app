# Payables Consistency and Purchase Progressive Loading Design

## Goal

Make Payables and Purchase feel immediate and keep their amounts and payment
statuses consistent everywhere.

## Decisions

- `purchase_items` is the only source of truth for Purchase Records and Payables.
- Payables shows Purchase Records whose `payment_status` is unpaid.
- Payables supports one payment action: **Mark Paid**.
- Mark Paid updates the matching `purchase_items.payment_status` to `paid`.
- The paid record disappears from Payables, remains visible in Purchase Records,
  and the Home Payables total decreases after refresh/realtime synchronization.
- Partial payment and manually created/edited Payables are removed from the UI.

## Payables Data Flow

A shared pure helper will normalize payment status, map purchase rows into
Payables rows, and calculate the outstanding summary. Both the Home card and
Payables page will use the same normalization and aggregation rules.

The Payables payment server action will validate the current staff role, update
the matching `purchase_items` row, and return a normalized string error when
Supabase reports a structured error. It will never read or update the legacy
`payables` table.

The Payables page may display cached rows immediately, but it must also carry
the matching summary and refresh it in the background. A successful Mark Paid
will optimistically remove the row and update the displayed total before the
server refresh completes.

## Purchase Loading Flow

Navigation-stack entry will no longer wait for one combined request containing
KPI, checklist, summary, and up to 500 purchase records.

The client will load and reveal content in this priority:

1. Purchase context and KPI, allowing the hero card to render.
2. Purchase Checklist.
3. Purchase Records and summary.

Each section keeps its own skeleton while pending. Failure in a later section
does not hide an earlier successful section. Cached data remains available for
instant repeat visits and is refreshed in the background.

The direct `/purchase` server route can continue providing server-rendered
initial data, but it should follow the same staged component state and shared
actions.

## Error Handling

- Supabase/PostgREST error objects are reduced to their `.message` string.
- Mark Paid reports an actionable text error and leaves the row visible when the
  update fails.
- Purchase section failures display a retry affordance for the failed stage
  without resetting already loaded stages.

## Verification

- Pure regression tests cover payment-status normalization, Payables row mapping,
  summary equality, and paid-row exclusion.
- A source-level loading contract test verifies that Purchase bootstrap no longer
  gates KPI, checklist, and records behind one `Promise.all`.
- Existing Purchase ledger tests, TypeScript checking, linting of changed files,
  and a production build verify integration.

