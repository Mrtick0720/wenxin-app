# Update Shaoxing Huadiao Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the existing `绍兴花雕酒` catalog row with the approved Malay and English names without creating a duplicate.

**Architecture:** Add one idempotent Supabase data migration that updates the row by exact Chinese name. Add a focused static test that verifies the migration remains an `UPDATE`, contains the approved values, and does not insert a duplicate.

**Tech Stack:** Supabase PostgreSQL migration, Node.js assertion script

---

### Task 1: Add a migration contract test

**Files:**
- Create: `scripts/test-shaoxing-catalog-migration.mjs`
- Test: `scripts/test-shaoxing-catalog-migration.mjs`

- [ ] **Step 1: Write the failing test**

Create a Node.js script that reads `supabase/migrations/20260621_update_shaoxing_huadiao_catalog.sql` and asserts:

```js
assert.match(sql, /UPDATE\s+public\.purchase_catalog/i)
assert.match(sql, /name_ms\s*=\s*'Arak Shaoxing Huadiao'/)
assert.match(sql, /name_en\s*=\s*'Shaoxing Huadiao Wine'/)
assert.match(sql, /WHERE\s+name_zh\s*=\s*'绍兴花雕酒'/i)
assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.purchase_catalog/i)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node scripts/test-shaoxing-catalog-migration.mjs
```

Expected: failure because the migration file does not exist.

### Task 2: Add the targeted catalog migration

**Files:**
- Create: `supabase/migrations/20260621_update_shaoxing_huadiao_catalog.sql`

- [ ] **Step 1: Write the minimal migration**

```sql
UPDATE public.purchase_catalog
SET
  name_ms = 'Arak Shaoxing Huadiao',
  name_en = 'Shaoxing Huadiao Wine'
WHERE name_zh = '绍兴花雕酒';
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
node scripts/test-shaoxing-catalog-migration.mjs
```

Expected: `Shaoxing catalog migration test passed.`

- [ ] **Step 3: Run project verification**

Run:

```bash
npx tsc --noEmit
git diff --check
```

Expected: both commands exit successfully.

- [ ] **Step 4: Commit only this task's files**

```bash
git add \
  docs/superpowers/plans/2026-06-21-update-shaoxing-huadiao-catalog.md \
  scripts/test-shaoxing-catalog-migration.mjs \
  supabase/migrations/20260621_update_shaoxing_huadiao_catalog.sql
git commit -m "data: update Shaoxing catalog names"
```
