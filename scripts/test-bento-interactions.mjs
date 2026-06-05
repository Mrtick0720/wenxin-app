import assert from 'node:assert/strict'
import {
  getBentoPanelAction,
  getBentoPullState,
  shouldShowBentoTodayShortcut,
} from '../lib/bentoInteractionUtils.ts'

assert.equal(
  shouldShowBentoTodayShortcut('2026-06-04', '2026-06-05', false),
  true,
  'shows Today shortcut on the Bento main page when viewing another date'
)

assert.equal(
  shouldShowBentoTodayShortcut('2026-06-04', '2026-06-05', true),
  false,
  'hides Today shortcut while the detail panel is open'
)

assert.equal(
  getBentoPanelAction({ dx: -120, dy: 12, threshold: 80, mode: 'open' }),
  'open',
  'left swipe past threshold opens the detail panel'
)

assert.equal(
  getBentoPanelAction({ dx: -30, dy: 4, threshold: 80, mode: 'open' }),
  'reset-closed',
  'short left swipe snaps the detail panel closed'
)

assert.equal(
  getBentoPanelAction({ dx: 120, dy: 9, threshold: 80, mode: 'close' }),
  'close',
  'right swipe past threshold closes the detail panel'
)

assert.deepEqual(
  getBentoPullState({ dy: 120, threshold: 70 }),
  { offset: 92, shouldRefresh: true },
  'downward pull is damped and refreshes beyond threshold'
)

assert.deepEqual(
  getBentoPullState({ dy: -80, threshold: 70 }),
  { offset: -22, shouldRefresh: false },
  'upward pull is lightly damped and never refreshes'
)

console.log('bento interaction tests passed')
