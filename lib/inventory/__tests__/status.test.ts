import { computeDisplayStatus, NEED_COUNT_DAYS } from '../status'

const BASE = {
  currentQuantity: 10,
  reorderLevel: 3,
  reorderPoint: 6 as number | null,
  lastCountedAt: new Date().toISOString() as string | null,
  category: 'Sauces',
}

describe('computeDisplayStatus', () => {
  it('returns out when quantity is 0', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 0 })).toBe('out')
  })

  it('returns low when quantity equals reorderLevel', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 3 })).toBe('low')
  })

  it('returns low when quantity is below reorderLevel', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 1 })).toBe('low')
  })

  it('returns need_reorder when quantity is between reorderLevel and reorderPoint', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 5 })).toBe('need_reorder')
  })

  it('returns need_reorder when quantity equals reorderPoint', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 6 })).toBe('need_reorder')
  })

  it('returns ok when quantity is above reorderPoint and recently counted', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 8 })).toBe('ok')
  })

  it('returns need_count when lastCountedAt is null', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 8, lastCountedAt: null })).toBe('need_count')
  })

  it('returns need_count for Fresh item not counted in 3 days', () => {
    const old = new Date(Date.now() - 4 * 86_400_000).toISOString()
    expect(computeDisplayStatus({ ...BASE, category: 'Fresh', reorderPoint: null, currentQuantity: 10, lastCountedAt: old })).toBe('need_count')
  })

  it('returns ok for Fresh item counted 2 days ago', () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString()
    expect(computeDisplayStatus({ ...BASE, category: 'Fresh', reorderPoint: null, currentQuantity: 10, lastCountedAt: recent })).toBe('ok')
  })

  it('returns need_count for Sauces item not counted in 14 days', () => {
    const old = new Date(Date.now() - 15 * 86_400_000).toISOString()
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 8, lastCountedAt: old })).toBe('need_count')
  })

  it('out takes priority over need_count when qty is 0 and never counted', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 0, lastCountedAt: null })).toBe('out')
  })

  it('low takes priority over need_count when qty is at reorderLevel and never counted', () => {
    expect(computeDisplayStatus({ ...BASE, currentQuantity: 3, lastCountedAt: null })).toBe('low')
  })

  it('NEED_COUNT_DAYS has correct values', () => {
    expect(NEED_COUNT_DAYS['Fresh']).toBe(3)
    expect(NEED_COUNT_DAYS['Drinks']).toBe(7)
    expect(NEED_COUNT_DAYS['Sauces']).toBe(14)
    expect(NEED_COUNT_DAYS['Dry Goods']).toBe(14)
    expect(NEED_COUNT_DAYS['Packaging']).toBe(14)
    expect(NEED_COUNT_DAYS['Supplies']).toBe(14)
  })
})
