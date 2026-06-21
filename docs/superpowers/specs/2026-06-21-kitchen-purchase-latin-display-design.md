# Kitchen Purchase Latin Display Design

## Goal

Show purchase item names using large Latin-letter catalog names throughout the
kitchen employee workflow, while preserving Chinese names for owners, managers,
stored records, and reports.

## Roles and Scope

The Latin-only display applies when the current staff role is `kitchen`.

It covers:

- the `Add to Checklist` catalog trigger and selection list;
- the selected item shown after choosing from the catalog;
- pending rows in `To Buy`;
- pending rows in `To Verify`;
- the `To Verify` accept, reject, and return sheet.

Owner and manager displays remain unchanged: Chinese is primary and Malay is
secondary.

## Display Name Rules

For kitchen staff:

1. Use `purchase_catalog.name_ms` as the visible item name.
2. Render it as the single primary name using the existing large, dark,
   semibold style.
3. Do not render the Chinese catalog name as secondary text.
4. Keep the unit and quantity visible as they are today.
5. If no Latin-letter catalog name exists, show `Unknown item` instead of
   exposing Chinese text.

Search remains able to match Chinese, Malay, pinyin, and fuzzy Latin input. This
change affects display only, not search capability.

## Data Handling

Catalog selection continues saving `name_zh` into checklist and purchase
records. This preserves existing reporting, matching, and historical data.

The UI resolves the kitchen-facing name by matching the stored record name
against the in-memory purchase catalog. Matching accepts either the Chinese or
Malay catalog name.

Create a shared catalog display-name helper in
`lib/purchaseLedger/catalog.ts`. Both `ChecklistSection` and
`PendingVerificationSection` use this helper so the fallback behavior stays
consistent.

## Component Changes

`CatalogCombobox` receives a display mode:

- `default`: Chinese primary, Malay secondary;
- `latin`: Malay primary only.

`PurchaseClient` selects `latin` mode when `ctx.role === 'kitchen'`, passes it
to the checklist flow, and passes catalog data plus kitchen-display intent to
the verification flow.

`PendingVerificationSection` resolves and uses the same Latin display name for
both its row and bottom sheet.

## Loading and Error States

While the catalog is loading, kitchen item names may show `...`.

If catalog loading fails or a stored item cannot be matched, the UI shows
`Unknown item`. It must not fall back to the stored Chinese name on kitchen
screens.

Owner and manager fallback behavior is unchanged.

## Verification

Automated tests will verify:

- a stored Chinese name resolves to its Malay catalog name in kitchen mode;
- an already-Malay stored name resolves correctly;
- a missing translation returns `Unknown item`;
- a missing catalog match returns `Unknown item`;
- default display mode still exposes Chinese primary and Malay secondary names;
- kitchen display mode exposes only the Latin primary name;
- TypeScript and lint checks pass.
