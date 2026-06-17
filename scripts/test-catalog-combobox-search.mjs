import { filterCatalogItems } from '../lib/purchaseLedger/catalog.ts'

const items = [
  { id: 1, name_zh: '菜心', name_ms: 'Sawi', category: 'Vegetables', unit: 'kg' },
  { id: 2, name_zh: '小白菜', name_ms: 'Baby Pak Choi', category: 'Vegetables', unit: 'kg' },
  { id: 3, name_zh: '牛腩', name_ms: 'Daging perut lembu', category: 'Meat', unit: 'kg' },
  { id: 4, name_zh: '韭菜', name_ms: 'Kucai', category: 'Vegetables', unit: 'kg' },
  { id: 5, name_zh: '黄梨', name_ms: 'Nanas', category: 'Fruit', unit: 'pcs' },
  { id: 6, name_zh: '鸡腿', name_ms: 'Paha Ayam', category: 'Meat', unit: 'kg' },
]

const cases = [
  ['', ['菜心', '小白菜', '牛腩', '韭菜', '黄梨', '鸡腿']],
  ['菜', ['菜心', '小白菜', '韭菜']],
  ['菜心', ['菜心']],
  ['sawi', ['菜心']],
  ['小', ['小白菜']],
  ['小白', ['小白菜']],
  ['小白菜', ['小白菜']],
  ['牛', ['牛腩']],
  ['牛腩', ['牛腩']],
  ['韭', ['韭菜']],
  ['kucai', ['韭菜']],
  ['nanas', ['黄梨']],
  ['paha', ['鸡腿']],
  [' Baby   Pak ', ['小白菜']],
  [' SA WI ', ['菜心']],
]

let failed = 0
for (const [query, expected] of cases) {
  const actual = filterCatalogItems(items, query).map((item) => item.name_zh)
  if (actual.join('|') !== expected.join('|')) {
    failed += 1
    console.error(`FAIL ${JSON.stringify(query)}: expected ${expected.join(', ')}, got ${actual.join(', ')}`)
  }
}

if (failed > 0) process.exit(1)
console.log('catalog combobox search tests passed')
