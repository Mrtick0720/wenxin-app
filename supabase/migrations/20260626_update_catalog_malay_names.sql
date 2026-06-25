-- Migration: correct Malay names for three purchase catalog items
-- Only name_ms is changed; name_zh and name_en are untouched.

BEGIN;

-- Lemon (seq 32, 柠檬): Limau → Lemon
UPDATE public.purchase_catalog
SET name_ms = 'Lemon'
WHERE name_zh = '柠檬' AND seq = 32;

-- White Onion (seq 56, 白洋葱): Bawang putih hoaland besar → Bawang Besar Holland
UPDATE public.purchase_catalog
SET name_ms = 'Bawang Besar Holland'
WHERE name_zh = '白洋葱' AND seq = 56;

-- Baby Romaine Lettuce (seq 4, 小油麦): Romaine Lettuce → Baby Romaine Lettuce
UPDATE public.purchase_catalog
SET name_ms = 'Baby Romaine Lettuce'
WHERE name_zh = '小油麦' AND seq = 4;

COMMIT;
