-- Migration: inventory_items — add purchase_catalog FK
-- ─────────────────────────────────────────────────────────────────────────────
-- Links inventory_items to purchase_catalog so the Purchase Catalog becomes
-- the single source of truth for item name, category, and unit.
--
-- catalog_id is NULLABLE: existing items created before this migration have no
-- catalog link and continue to work. New items created via the updated UI must
-- always reference a catalog entry.
--
-- The partial unique index prevents two inventory items for the same catalog
-- item, while still allowing multiple uncatalogued (legacy) items.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS catalog_id integer
    REFERENCES public.purchase_catalog(id) ON DELETE SET NULL;

-- One inventory item per catalog item per outlet (for linked items only)
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_catalog_outlet_uniq
  ON public.inventory_items (catalog_id, outlet_id)
  WHERE catalog_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'catalog_id'
  ) THEN
    RAISE EXCEPTION 'catalog_id column not added to inventory_items';
  END IF;
END;
$$;

COMMIT;
