-- Migration: purchase_catalog table + seed data (138 items, with English names)
-- Apply in Supabase SQL Editor.

BEGIN;

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_catalog (
  id          serial primary key,
  seq         integer not null,
  name_ms     text,             -- Malay name
  name_zh     text not null,    -- Chinese name (primary display)
  name_en     text,             -- English name (for search)
  category    text not null,    -- matches PURCHASE_CATEGORIES in the app
  unit        text not null,    -- simple unit key (kg, bag, pack, …)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.purchase_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog readable by authenticated" ON public.purchase_catalog;
CREATE POLICY "catalog readable by authenticated"
  ON public.purchase_catalog FOR SELECT
  TO authenticated USING (true);

-- ── Seed data ──────────────────────────────────────────────────────────────
-- Idempotent: skips rows whose (name_zh, name_ms, category) already exist.
-- Columns: seq, name_ms, name_zh, name_en, category, unit
INSERT INTO public.purchase_catalog (seq, name_ms, name_zh, name_en, category, unit)
SELECT v.seq, v.name_ms, v.name_zh, v.name_en, v.category, v.unit
FROM (VALUES
  (1, 'Sawi', '菜心', 'Chinese Flowering Cabbage', 'Vegetables', 'bag'),
  (2, 'Pucuk Ubi', '番薯叶', 'Sweet Potato Leaves', 'Vegetables', 'bag'),
  (3, 'Kangkung', '空心菜', 'Water Spinach', 'Vegetables', 'bag'),
  (4, 'Romaine Lettuce', '小油麦', 'Romaine Lettuce', 'Vegetables', 'kg'),
  (5, 'Baby Pak Choi', '小白菜', 'Baby Pak Choi', 'Vegetables', 'bag'),
  (6, 'Kucai', '韭菜', 'Chives', 'Vegetables', 'kg'),
  (7, 'Peria', '苦瓜', 'Bitter Gourd', 'Vegetables', 'kg'),
  (8, 'Terung / Eggplant', '茄子', 'Eggplant', 'Vegetables', 'kg'),
  (9, 'Timun/Cucumber', '本地青瓜', 'Cucumber', 'Vegetables', 'kg'),
  (10, 'Japan Timun/Cucumber', '日本青瓜', 'Japanese Cucumber', 'Vegetables', 'kg'),
  (11, 'Capsicum green', '大青椒', 'Green Capsicum', 'Vegetables', 'kg'),
  (12, 'Cili merah', '红辣椒', 'Red Chili', 'Vegetables', 'kg'),
  (13, 'Brokoli', '西兰花', 'Broccoli', 'Vegetables', 'kg'),
  (14, 'Tomato', '西红柿', 'Tomato', 'Vegetables', 'kg'),
  (15, 'Kentang/Potato', '土豆', 'Potato', 'Vegetables', 'bag'),
  (16, 'Kubis Cina', '白菜', 'Napa Cabbage', 'Vegetables', 'kg'),
  (17, 'Bendi/Okra', '秋葵/羊角豆', 'Okra', 'Vegetables', 'kg'),
  (18, 'Lobak merah', '胡萝卜', 'Carrot', 'Vegetables', 'kg'),
  (19, 'Lobak putih/Radish', '白萝卜', 'White Radish / Daikon', 'Vegetables', 'kg'),
  (20, 'Kacang panjang', '四季豆', 'Long Beans', 'Vegetables', 'bag'),
  (21, 'Tauge/bean sprouts', '豆芽', 'Bean Sprouts', 'Vegetables', 'kg'),
  (22, 'Jagung', '玉米', 'Corn', 'Vegetables', 'pack'),
  (23, 'Ubi keledek', '红薯', 'Sweet Potato', 'Vegetables', 'kg'),
  (24, 'Nanas', '黄梨', 'Pineapple', 'Vegetables', 'kg'),
  (25, 'Daun ketumbar/Coriander', '香菜', 'Coriander', 'Vegetables', 'kg'),
  (26, 'Celery / Daun Seleri', '芹菜', 'Celery', 'Vegetables', 'kg'),
  (27, 'Daun bawang kecil', '小青葱', 'Spring Onion', 'Vegetables', 'kg'),
  (28, 'Daun bawang besar', '大青葱', 'Leek', 'Vegetables', 'kg'),
  (29, 'Cili padi', '小辣椒', 'Bird''s Eye Chili', 'Vegetables', 'kg'),
  (30, 'Halia', '姜', 'Ginger', 'Vegetables', 'kg'),
  (31, 'Bawang putih', '蒜', 'Garlic', 'Vegetables', 'kg'),
  (32, 'Limau', '柠檬', 'Lime', 'Vegetables', 'kg'),
  (33, 'Limau Kasturi', '桔仔', 'Calamansi', 'Vegetables', 'kg'),
  (34, 'Avokado', '牛油果', 'Avocado', 'Vegetables', 'kg'),
  (35, 'Pisang', '香蕉', 'Banana', 'Vegetables', 'kg'),
  (36, 'Winter melon', '冬瓜', 'Winter Melon', 'Vegetables', 'kg'),
  (37, 'Cherry Tomato', '樱桃番茄', 'Cherry Tomato', 'Vegetables', 'kg'),
  (38, 'Papaya', '木瓜', 'Papaya', 'Vegetables', 'kg'),
  (39, 'Cendawan Hitam', '木耳', 'Black Fungus / Wood Ear Mushroom', 'Vegetables', 'kg'),
  (40, 'Nanas', '菠萝', 'Pineapple', 'Vegetables', 'kg'),
  (41, 'Bihun kaca / Vermicelli', '粉丝', 'Glass Noodles / Vermicelli', 'Grocery', 'pack'),
  (42, 'Tauhu Putih', '白豆腐', 'White Tofu', 'Grocery', 'pcs'),
  (43, 'Tauhu kering', '豆干', 'Firm Tofu', 'Grocery', 'pcs'),
  (44, 'Fucuk', '腐竹', 'Tofu Skin / Bean Curd Stick', 'Grocery', 'pack'),
  (45, 'Cendawan shiitake', '香菇', 'Shiitake Mushroom', 'Grocery', 'pack'),
  (46, 'Beras', '香米', 'Jasmine Rice', 'Grocery', 'bag'),
  (47, 'Nasi pekerja', '员工米', 'Staff Rice', 'Grocery', 'bag'),
  (48, 'Tuaran Mee', '斗亚兰面', 'Tuaran Noodles', 'Grocery', 'kg'),
  (49, 'Kulit wantan', '馄饨皮', 'Wonton Skin', 'Grocery', 'pack'),
  (50, 'Flour', '面粉', 'Flour', 'Grocery', 'pack'),
  (51, 'Telur', '鸡蛋', 'Chicken Egg', 'Grocery', 'tray'),
  (52, 'Telur masin', '咸鸭蛋', 'Salted Duck Egg', 'Grocery', 'tray'),
  (53, 'Pidan', '皮蛋', 'Century Egg', 'Grocery', 'box'),
  (54, 'Daun kari', '咖喱叶', 'Curry Leaf', 'Grocery', 'bundle'),
  (55, 'Bawang Merah Besar', '大红葱', 'Red Shallot', 'Grocery', 'bag'),
  (56, 'Bawang putih hoaland besar', '白洋葱', 'White Onion', 'Grocery', 'bag'),
  (57, 'Cili kering', '干辣椒', 'Dried Chili', 'Grocery', 'kg'),
  (58, 'Lada Sichuan', '花椒', 'Sichuan Peppercorn', 'Grocery', 'kg'),
  (59, 'Serbuk lada Sichuan', '花椒粉', 'Sichuan Pepper Powder', 'Grocery', 'kg'),
  (60, 'White pepper', '白胡椒粉', 'White Pepper', 'Grocery', 'bottle'),
  (61, 'Tepung jagung', '玉米淀粉', 'Cornstarch', 'Grocery', 'pack'),
  (62, 'Taucu hitam', '豆豉', 'Fermented Black Bean', 'Grocery', 'kg'),
  (63, 'Kulit kayu manis', '桂皮', 'Cinnamon Bark', 'Grocery', 'kg'),
  (64, 'Bai Zhi (jarang diterjemah)', '白芷', 'Angelica Root', 'Grocery', 'kg'),
  (65, 'Daun bay', '香叶', 'Bay Leaf', 'Grocery', 'kg'),
  (66, 'Bunga lawang', '八角', 'Star Anise', 'Grocery', 'kg'),
  (67, 'Sayur asin Cina', '冬菜', 'Preserved Vegetable', 'Grocery', 'kg'),
  (68, 'Cili jeruk', '泡椒', 'Pickled Chili', 'Grocery', 'kg'),
  (69, 'Sayur jeruk Sichuan', '四川酸菜', 'Sichuan Pickled Mustard', 'Grocery', 'kg'),
  (70, 'Pes kacang pedas', '豆瓣酱', 'Doubanjiang / Chili Bean Paste', 'Grocery', 'kg'),
  (71, 'Sos Chu Hou', '柱侯酱', 'Chu Hou Paste', 'Grocery', 'kg'),
  (72, 'Sos ayam panggang', '鸡煲酱', 'Chicken Hotpot Sauce', 'Grocery', 'kg'),
  (73, 'Tomato Ketchup', '西红柿酱', 'Tomato Ketchup', 'Grocery', 'kg'),
  (74, 'Kicap cair untuk stim ikan', '蒸鱼豉油', 'Steamed Fish Soy Sauce', 'Grocery', 'kg'),
  (75, 'Sos tiram', '蚝油', 'Oyster Sauce', 'Grocery', 'kg'),
  (76, 'Pes kacang soya', '黄豆酱', 'Yellow Bean Paste', 'Grocery', 'kg'),
  (77, 'Kicap Cair', '生抽', 'Light Soy Sauce', 'Grocery', 'kg'),
  (78, 'Kicap Pekat', '老抽', 'Dark Soy Sauce', 'Grocery', 'kg'),
  (79, 'Karamel Masakan', '晒油', 'Cooking Caramel', 'Grocery', 'kg'),
  (80, 'Cuka hitam', '黑醋', 'Black Vinegar', 'Grocery', 'kg'),
  (81, 'Cuka putih', '白醋', 'White Vinegar', 'Grocery', 'kg'),
  (82, 'Minyak bijan', '芝麻油', 'Sesame Oil', 'Grocery', 'kg'),
  (83, 'Minyak masak', '食用油', 'Cooking Oil', 'Grocery', 'kg'),
  (84, 'Minyak lada Sichuan', '花椒油', 'Sichuan Chili Oil', 'Grocery', 'kg'),
  (85, 'Cooking Shao Hsing Jiu', '绍兴花雕酒', 'Shaoxing Rice Wine', 'Grocery', 'bottle'),
  (86, 'Garam', '盐', 'Salt', 'Grocery', 'pack'),
  (87, 'Serbuk pati ayam', '鸡精', 'Chicken Powder', 'Grocery', 'pack'),
  (88, 'Monosodium glutamat', '味精', 'MSG', 'Grocery', 'pack'),
  (89, 'Gula putih', '白糖', 'White Sugar', 'Grocery', 'pack'),
  (90, 'Gula batu', '冰糖', 'Rock Sugar', 'Grocery', 'pack'),
  (91, 'Bawang putih goreng', '炸香蒜', 'Crispy Garlic', 'Grocery', 'pack'),
  (92, 'Kurma merah Cina', '红枣', 'Red Date / Jujube', 'Grocery', 'pack'),
  (93, 'Goji berry', '枸杞', 'Goji Berry', 'Grocery', 'pack'),
  (94, 'Seaweed', '紫菜', 'Seaweed', 'Grocery', 'pack'),
  (95, 'Serai', '香茅', 'Lemongrass', 'Grocery', 'bundle'),
  (96, 'Daun Pandan', '斑斓叶', 'Pandan Leaf', 'Grocery', 'bundle'),
  (97, 'Honey', '蜂蜜', 'Honey', 'Grocery', 'bottle'),
  (98, 'Kacang tanah', '花生', 'Peanut', 'Grocery', 'kg'),
  (99, 'Ikan bilis', '江鱼仔', 'Dried Anchovies / Ikan Bilis', 'Seafood', 'kg'),
  (100, 'Ikan', '鱼', 'Fish', 'Seafood', 'kg'),
  (101, 'Ikan - makanan pekerja', '鱼-员工餐', 'Fish - Staff Meal', 'Seafood', 'kg'),
  (102, 'Udang', '虾', 'Prawn / Shrimp', 'Seafood', 'kg'),
  (103, 'Isi udang', '虾仁', 'Peeled Shrimp', 'Seafood', 'bottle'),
  (104, 'Crab meat', '蟹肉', 'Crab Meat', 'Seafood', 'pack'),
  (105, 'Ketam', '螃蟹', 'Crab / Ketam', 'Seafood', 'pcs'),
  (106, 'Kepak ayam', '鸡翅', 'Chicken Wing', 'Meat', 'kg'),
  (107, 'Paha ayam', '鸡腿', 'Chicken Leg', 'Meat', 'kg'),
  (108, 'Kaki ayam', '鸡脚', 'Chicken Feet', 'Meat', 'kg'),
  (109, 'Dada ayam', '鸡胸', 'Chicken Breast', 'Meat', 'kg'),
  (110, 'Rangka ayam', '鸡骨架', 'Chicken Carcass', 'Meat', 'kg'),
  (111, 'Daging perut lembu', '牛腩', 'Beef Brisket', 'Meat', 'kg'),
  (112, 'Urat keting', '牛筋', 'Beef Tendon', 'Meat', 'kg'),
  (113, 'Perut lembu', '牛肚', 'Beef Tripe', 'Meat', 'kg'),
  (114, 'Tulang lembu', '牛骨', 'Beef Bone', 'Meat', 'kg'),
  (115, 'Beef manis', '牛里脊', 'Beef Tenderloin', 'Meat', 'kg'),
  (116, 'Daging kambing', '羊肉', 'Lamb / Mutton', 'Meat', 'kg'),
  (117, 'Paha Kambing', '羊腿', 'Lamb Leg', 'Meat', 'kg'),
  (118, 'Gas', '燃气', 'Gas', 'Others', 'pail'),
  (119, 'Tiger', '虎牌啤酒', 'Tiger Beer', 'Beverage', 'carton'),
  (120, 'Spritzer', '矿泉水', 'Spritzer Mineral Water', 'Beverage', 'carton'),
  (121, 'Coca Cola', '可乐', 'Coca-Cola', 'Beverage', 'carton'),
  (122, 'Coca-Cola Zero', '零度可乐', 'Coca-Cola Zero', 'Beverage', 'carton'),
  (123, 'Vanilla Cola', '香草可乐', 'Vanilla Cola', 'Beverage', 'carton'),
  (124, 'Sprite', '雪碧', 'Sprite', 'Beverage', 'carton'),
  (125, '100 Plus', '100 Plus', '100 Plus', 'Beverage', 'carton'),
  (126, 'Jia Duo Bao', '加多宝', 'JDB Herbal Tea', 'Beverage', 'carton'),
  (127, 'Chinese Tea', '中国茶', 'Chinese Tea', 'Beverage', 'pack'),
  (128, 'Mop', '拖把', 'Mop', 'Others', 'pcs'),
  (129, 'Food pouch / Beg makanan', '食品包装袋', 'Food Pouch', 'Packaging', 'bag'),
  (130, 'Trash bag / beg sampah', '垃圾袋', 'Trash Bag', 'Packaging', 'bag'),
  (131, 'Plastic Bag', '打包袋', 'Plastic Bag', 'Packaging', 'bag'),
  (132, 'Deep Rectangular Container', '深长方型打包盒', 'Deep Rectangular Container', 'Packaging', 'bag'),
  (133, 'Round Takeaway Container', '圆打包盒', 'Round Takeaway Container', 'Packaging', 'bag'),
  (134, 'Large Claypot Container', '大份砂锅打包盒', 'Large Claypot Container', 'Packaging', 'bag'),
  (135, 'Sabun Pencuci Pinggan', '洗碗水', 'Dish Soap', 'Packaging', 'pail'),
  (136, 'Serbuk pencuci', '洗衣粉', 'Laundry Powder', 'Packaging', 'pack'),
  (137, 'Clorox Bleach', 'clorox 漂白剂', 'Clorox Bleach', 'Others', 'bottle'),
  (138, 'Racun perosak', '杀虫剂', 'Pesticide', 'Others', 'bottle')
) AS v(seq, name_ms, name_zh, name_en, category, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_catalog p
  WHERE p.name_zh    = v.name_zh
    AND p.category   = v.category
    AND p.name_ms IS NOT DISTINCT FROM v.name_ms
);

COMMIT;