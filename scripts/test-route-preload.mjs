import assert from 'node:assert/strict'
import { preloadRouteLoaders } from '../lib/routePreload.ts'

const loaded = []
preloadRouteLoaders([
  async () => { loaded.push('purchase') },
  async () => { loaded.push('bento') },
])

assert.deepEqual(
  loaded,
  ['purchase', 'bento'],
  'preloading invokes each real dynamic import loader immediately',
)

console.log('route preload tests passed')
