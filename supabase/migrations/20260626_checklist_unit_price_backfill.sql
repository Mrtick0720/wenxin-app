-- Backfill purchase_checklist.unit_price for rows created before the snapshot
-- logic was introduced. For each unpriced checklist item, find the most recent
-- purchase_items row with the same name that has a recorded unit_price.
--
-- Safe / idempotent:
--   - WHERE clause restricts to NULL or 0 only — rows already priced are untouched.
--   - If no matching purchase_items row exists, the subquery returns NULL and the
--     checklist row is left as-is (no change, no error).
--   - Can be re-run at any time without side effects.
--
-- Ordering: purchase_items.id DESC — id is a serial so higher = more recent.

UPDATE public.purchase_checklist c
SET    unit_price = (
  SELECT pi.unit_price
  FROM   public.purchase_items pi
  WHERE  pi.name = c.name
    AND  pi.unit_price IS NOT NULL
    AND  pi.unit_price > 0
  ORDER  BY pi.id DESC
  LIMIT  1
)
WHERE (c.unit_price IS NULL OR c.unit_price = 0);
