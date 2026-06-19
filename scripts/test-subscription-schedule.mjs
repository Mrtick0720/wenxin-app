import assert from 'node:assert/strict'
import {
  buildSubscriptionPlan,
  getDefaultMenuType,
  isWeekend,
} from '../lib/subscriptionSchedule.ts'

const base = buildSubscriptionPlan({
  startDate: '2026-06-05',
  totalMeals: 20,
  existingDays: [],
  holidays: [],
  defaults: { menuType: 'standard', timeSlot: 'lunch', note: '' },
})

assert.equal(isWeekend('2026-06-06'), true, 'Saturday is a weekend')
assert.equal(base.days.length, 20, 'creates one scheduled day per meal')
assert.equal(base.days[0].date, '2026-06-05', 'starts on the selected start date')
assert.equal(base.days[1].date, '2026-06-08', 'skips the weekend after a Friday start')
assert.equal(base.endDate, '2026-07-02', '20 weekday meals from Jun 5 end on Jul 2')
assert.equal(base.days[19].meal_number, 20, 'last active day is meal number 20')

const daily = buildSubscriptionPlan({
  startDate: '2026-06-16',
  totalMeals: 30,
  existingDays: [
    {
      id: 5,
      customer_id: 1,
      date: '2026-06-20',
      status: 'skipped',
      meal_number: null,
      menu_type: 'standard',
      time_slot: 'lunch',
      note: '',
      order_id: null,
    },
    {
      id: 30,
      customer_id: 1,
      date: '2026-07-16',
      status: 'scheduled',
      meal_number: 23,
      menu_type: 'standard',
      time_slot: 'lunch',
      note: '',
      order_id: null,
    },
  ],
  holidays: [],
  defaults: { menuType: 'standard', timeSlot: 'lunch', note: '' },
  customerId: 1,
  deliveryFrequency: 'daily',
})

assert.equal(daily.endDate, '2026-07-15', '30 daily meals from Jun 16 end on Jul 15')
assert.equal(daily.days.length, 30, 'daily subscriptions contain exactly totalMeals calendar days')
assert.equal(daily.days[0].date, '2026-06-16', 'daily subscriptions include the start date')
assert.equal(daily.days[29].date, '2026-07-15', 'daily subscriptions stop on the fixed end date')
assert.equal(daily.days.some(day => day.date === '2026-07-16'), false, 'stale future rows do not extend a daily plan')

const skipped = buildSubscriptionPlan({
  startDate: '2026-06-05',
  totalMeals: 20,
  existingDays: [
    {
      id: 9,
      customer_id: 1,
      date: '2026-06-10',
      status: 'skipped',
      meal_number: null,
      menu_type: 'signature',
      time_slot: 'lunch',
      note: 'family trip',
      order_id: 42,
    },
  ],
  holidays: [],
  defaults: { menuType: 'standard', timeSlot: 'lunch', note: '' },
})

assert.equal(skipped.days.find(day => day.date === '2026-06-10')?.status, 'skipped', 'keeps skipped days visible')
assert.equal(skipped.days.filter(day => day.status === 'scheduled').length, 20, 'skipped days do not consume a meal')
assert.equal(skipped.endDate, '2026-07-03', 'skip extends the end date by one working day')

const holiday = buildSubscriptionPlan({
  startDate: '2026-06-05',
  totalMeals: 3,
  existingDays: [],
  holidays: [{ date: '2026-06-08', name: 'Public Holiday' }],
  defaults: { menuType: 'standard', timeSlot: 'lunch', note: '' },
})

assert.equal(holiday.days.find(day => day.date === '2026-06-08')?.holiday_name, 'Public Holiday', 'public holidays are marked for review')
assert.equal(holiday.days.find(day => day.date === '2026-06-08')?.status, 'scheduled', 'public holidays are warnings, not automatic skips')
assert.equal(getDefaultMenuType('Vegetarian no spicy'), 'vegetarian', 'detects vegetarian menu preference')
assert.equal(getDefaultMenuType('Signature plan'), 'signature', 'detects signature menu preference')
assert.equal(getDefaultMenuType(''), 'standard', 'falls back to standard')

console.log('subscription schedule tests passed')
