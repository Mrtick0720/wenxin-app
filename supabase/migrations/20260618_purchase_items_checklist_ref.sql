-- Back-reference from purchase_items → purchase_checklist.
-- Enables client-side reconciliation across the race window between the two
-- DB writes in completeChecklistItemAction (INSERT record, then UPDATE checklist).
-- With this column the client can remove the checklist item from display as soon
-- as the record appears, even before the checklist row's status is flipped.

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS checklist_item_id bigint
    REFERENCES public.purchase_checklist(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_items_checklist_item_id_idx
  ON public.purchase_items (checklist_item_id)
  WHERE checklist_item_id IS NOT NULL;
