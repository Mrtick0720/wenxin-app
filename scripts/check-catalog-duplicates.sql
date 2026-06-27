-- Diagnostic: find duplicate rows in purchase_catalog
-- Run in Supabase SQL Editor before applying the unique index migration.
-- All three queries should return zero rows before you proceed.

-- 1. Active duplicates by (name_zh, name_ms, category) — the exact columns
--    the unique index will enforce. Fix these before running the migration.
SELECT
  name_zh,
  name_ms,
  category,
  COUNT(*)                    AS cnt,
  array_agg(id  ORDER BY id)  AS ids,
  array_agg(seq ORDER BY id)  AS seqs,
  array_agg(created_at ORDER BY id) AS created_ats
FROM public.purchase_catalog
WHERE active = true
GROUP BY name_zh, name_ms, category
HAVING COUNT(*) > 1
ORDER BY name_zh;

-- 2. All duplicates including inactive rows — broader view for reference.
SELECT
  name_zh,
  name_ms,
  category,
  active,
  COUNT(*)                    AS cnt,
  array_agg(id  ORDER BY id)  AS ids
FROM public.purchase_catalog
GROUP BY name_zh, name_ms, category, active
HAVING COUNT(*) > 1
ORDER BY name_zh, active;

-- 3. Rows with NULL name_ms — PostgreSQL unique indexes treat NULL as distinct,
--    so two rows with name_ms IS NULL share the same name_zh+category would
--    slip past the index. Confirm there are none.
SELECT id, seq, name_zh, category, active, created_at
FROM public.purchase_catalog
WHERE name_ms IS NULL
ORDER BY id;

-- 4. To safely remove the lower-id duplicate for a specific item, use:
--
--   BEGIN;
--
--   -- Verify the id you are about to delete has no inventory reference
--   SELECT ii.id, ii.name, pc.id AS cat_id, pc.name_zh
--   FROM public.inventory_items ii
--   JOIN public.purchase_catalog pc ON pc.id = ii.catalog_id
--   WHERE pc.id = <DELETE_ID>;
--
--   -- Delete only if the check above returns zero rows
--   DELETE FROM public.purchase_catalog WHERE id = <DELETE_ID>;
--
--   COMMIT;
