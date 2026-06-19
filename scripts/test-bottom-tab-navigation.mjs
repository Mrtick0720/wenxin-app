import assert from 'node:assert/strict'
import { resolveBottomTabAction } from '../lib/bottomTabNavigation.ts'

assert.equal(
  resolveBottomTabAction({ href: '/', currentPath: '/bento/customers/1' }),
  'home',
  'Home always resets the stack, even from a nested Bento page',
)

assert.equal(
  resolveBottomTabAction({ href: '/purchase', currentPath: '/bento/customers/1' }),
  'tab-root',
  'switching tabs replaces the entire nested stack with the selected tab root',
)

assert.equal(
  resolveBottomTabAction({ href: '/bento', currentPath: '/bento/customers/1' }),
  'tab-root',
  'tapping Bento from a nested Bento page returns to the Bento root',
)

assert.equal(
  resolveBottomTabAction({ href: '/purchase', currentPath: '/purchase' }),
  'noop',
  'tapping the already active tab root does not add another layer',
)

console.log('bottom tab navigation tests passed')
