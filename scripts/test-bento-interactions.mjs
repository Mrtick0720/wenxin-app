import assert from 'node:assert/strict'
import {
  getBentoCloseGestureAxis,
  getBentoGestureAxis,
  getBentoPanelAction,
  getBentoPullState,
  getBentoSwipeThreshold,
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
  getBentoSwipeThreshold(390),
  36,
  'phone-sized screens use a low swipe threshold for a more responsive panel'
)

assert.equal(
  getBentoGestureAxis({ dx: -52, dy: 31 }),
  'h',
  'slightly diagonal Android left swipes still count as horizontal'
)

assert.equal(
  getBentoPanelAction({ dx: -52, dy: 31, threshold: getBentoSwipeThreshold(390), mode: 'open' }),
  'open',
  'shorter slightly diagonal left swipe opens the detail panel'
)

assert.equal(
  getBentoPanelAction({ dx: -38, dy: 24, threshold: getBentoSwipeThreshold(390), mode: 'open' }),
  'open',
  'short Android left swipes open the detail panel'
)

assert.equal(
  getBentoCloseGestureAxis({ dx: 28, dy: 46 }),
  'v',
  'detail page vertical scrolling wins over diagonal movement'
)

assert.equal(
  getBentoPanelAction({ dx: 28, dy: 46, threshold: getBentoSwipeThreshold(390), mode: 'close' }),
  'none',
  'diagonal vertical movement in detail page does not block scrolling'
)

assert.equal(
  getBentoPanelAction({ dx: 58, dy: 14, threshold: getBentoSwipeThreshold(390), mode: 'close' }),
  'close',
  'clear right swipe closes the detail panel'
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
