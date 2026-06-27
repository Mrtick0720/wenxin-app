-- Migration: purchase_catalog — partial unique index on active item names
-- ─────────────────────────────────────────────────────────────────────────────
-- Enforces that no two active catalog rows share the same
-- (name_zh, name_ms, category) triple.
--
-- Partial index (WHERE active = true): inactive/archived rows are excluded so
-- a deactivated item does not block a future re-entry under a new id.
--
-- NULL name_ms caveat: PostgreSQL unique indexes treat NULL as distinct from
-- every other value, including another NULL. Two active rows both with
-- name_ms IS NULL and the same name_zh + category would not be blocked by
-- this index. In practice name_ms is always populated; the INSERT guard
-- (WHERE NOT EXISTS … IS NOT DISTINCT FROM) in each catalog migration covers
-- the NULL case at write time.
--
-- Safe to re-run: guarded by the duplicate check DO block and
-- CREATE UNIQUE INDEX IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Safety guard ──────────────────────────────────────────────────────────────
-- Fail fast if active duplicates already exist so the migration never leaves
-- the database in a state where the index cannot be created.
-- GROUP BY treats NULLs as equal, catching null-name_ms duplicates too.

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT name_zh, name_ms, category
    FROM   public.purchase_catalog
    WHERE  active = true
    GROUP  BY name_zh, name_ms, category
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique index — % active duplicate (name_zh, name_ms, category) '
      'group(s) found. Run scripts/check-catalog-duplicates.sql to identify and '
      'remove the extras, then re-run this migration.',
      dup_count;
  END IF;
END;
$$;

-- ── Unique index ──────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS purchase_catalog_active_name_uniq
  ON public.purchase_catalog (name_zh, name_ms, category)
  WHERE active = true;

-- ── Validation ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'purchase_catalog'
      AND indexname  = 'purchase_catalog_active_name_uniq'
  ) THEN
    RAISE EXCEPTION 'Unique index purchase_catalog_active_name_uniq was not created';
  END IF;
END;
$$;

COMMIT;
