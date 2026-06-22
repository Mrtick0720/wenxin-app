import assert from 'node:assert/strict'
import {
  resolveCatalogDisplayName,
  type CatalogItem,
} from '../lib/purchaseLedger/catalog'

const catalog: CatalogItem[] = [
  {
    id: 85,
    name_zh: '绍兴花雕酒',
    name_ms: 'Arak Shaoxing Huadiao',
    category: 'Grocery',
    unit: 'bottle',
  },
]

const untranslatedCatalog: CatalogItem[] = [
  {
    id: 999,
    name_zh: '无翻译',
    name_ms: null,
    category: 'Grocery',
    unit: 'pcs',
  },
]

assert.equal(
  resolveCatalogDisplayName('绍兴花雕酒', catalog, 'latin'),
  'Arak Shaoxing Huadiao',
)
assert.equal(
  resolveCatalogDisplayName('Arak Shaoxing Huadiao', catalog, 'latin'),
  'Arak Shaoxing Huadiao',
)
assert.equal(resolveCatalogDisplayName('不存在', catalog, 'latin'), 'Unknown item')
assert.equal(
  resolveCatalogDisplayName('无翻译', untranslatedCatalog, 'latin'),
  'Unknown item',
)
assert.equal(
  resolveCatalogDisplayName('绍兴花雕酒', catalog, 'default'),
  '绍兴花雕酒',
)

console.log('Purchase catalog display tests passed.')
