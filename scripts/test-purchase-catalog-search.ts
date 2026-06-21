import assert from 'node:assert/strict'
import {
  filterCatalogItems,
  type CatalogItem,
} from '../lib/purchaseLedger/catalog'

const fixtures: CatalogItem[] = [
  {
    id: 85,
    name_zh: '绍兴花雕酒',
    name_ms: 'Arak Shaoxing Huadiao',
    category: 'Grocery',
    unit: 'bottle',
  },
  {
    id: 139,
    name_zh: '青尖椒',
    name_ms: 'Cili Hijau',
    category: 'Vegetables',
    unit: 'kg',
  },
  {
    id: 12,
    name_zh: '红辣椒',
    name_ms: 'Cili merah',
    category: 'Vegetables',
    unit: 'kg',
  },
]

function search(query: string): CatalogItem[] {
  return filterCatalogItems(fixtures, query)
}

assert.equal(search('saoxing')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('shaoxing')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('shaoxign')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('huadiao')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('sxhdj')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('arak shaoxing')[0]?.name_zh, '绍兴花雕酒')
assert.equal(search('cili hija')[0]?.name_zh, '青尖椒')
assert.equal(search('绍兴')[0]?.name_zh, '绍兴花雕酒')
assert.deepEqual(search(''), fixtures)
assert.deepEqual(search('unrelatedvalue'), [])

console.log('Purchase catalog search tests passed.')
