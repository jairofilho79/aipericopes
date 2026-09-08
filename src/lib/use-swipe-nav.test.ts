import { describe, expect, it } from 'vitest'
import { shouldSwipe, SWIPE_MAX_MS, SWIPE_MIN_X } from './use-swipe-nav'

describe('shouldSwipe', () => {
  it('gesto horizontal amplo e rápido dispara nos dois sentidos', () => {
    expect(shouldSwipe(-120, 10, 200)).toBe(true)
    expect(shouldSwipe(120, -10, 200)).toBe(true)
  })

  it('deslocamento horizontal curto não dispara', () => {
    expect(shouldSwipe(-40, 0, 200)).toBe(false)
    expect(shouldSwipe(69, 0, 200)).toBe(false)
  })

  it('gesto diagonal não dispara (rolagem tem precedência)', () => {
    expect(shouldSwipe(100, 60, 200)).toBe(false)
    expect(shouldSwipe(-100, -80, 200)).toBe(false)
  })

  it('gesto lento demais não dispara', () => {
    expect(shouldSwipe(200, 5, 900)).toBe(false)
    expect(shouldSwipe(200, 5, SWIPE_MAX_MS + 1)).toBe(false)
  })

  it('os limites exatos contam como swipe', () => {
    expect(shouldSwipe(SWIPE_MIN_X, 0, SWIPE_MAX_MS)).toBe(true)
    expect(shouldSwipe(-SWIPE_MIN_X, 35, 300)).toBe(true)
  })

  it('gesto parado não dispara', () => {
    expect(shouldSwipe(0, 0, 0)).toBe(false)
  })
})
