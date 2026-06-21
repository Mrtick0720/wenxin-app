# Update Shaoxing Huadiao Purchase Catalog Design

## Goal

Update the existing `绍兴花雕酒` purchase catalog entry so the dropdown uses the approved Malay and English names without creating a duplicate item.

## Data Change

Match the active catalog row whose Chinese name is exactly `绍兴花雕酒`, then set:

- `name_ms`: `Arak Shaoxing Huadiao`
- `category`: remain `Grocery`
- `unit`: remain `bottle`

The deployed catalog table does not contain a `name_en` column, and the app's
catalog dropdown reads Chinese and Malay names only.

## Implementation

Create a new Supabase migration containing a targeted `UPDATE` statement. Do not edit the original catalog seed migration because it may already have been applied in deployed environments.

The migration will be idempotent: rerunning it leaves the row in the same desired state.

## Verification

Check that the migration:

1. targets only the exact Chinese catalog name;
2. contains the approved Malay name;
3. does not insert a second catalog row;
4. passes the project type check after being added.
