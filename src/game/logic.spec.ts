import { describe, expect, it } from 'vitest'
import {
  FOUND_DWELL_MS,
  FoundTracker,
  GREEN_MAX_M,
  isWithinRadius,
  proximityColor,
  YELLOW_MAX_M,
} from './logic'

describe('proximityColor', () => {
  it('returns green below green band', () => {
    expect(proximityColor(0)).toBe('green')
    expect(proximityColor(GREEN_MAX_M - 0.1)).toBe('green')
  })

  it('returns yellow in the middle band', () => {
    expect(proximityColor(GREEN_MAX_M)).toBe('yellow')
    expect(proximityColor(YELLOW_MAX_M - 0.1)).toBe('yellow')
  })

  it('returns red beyond yellow band', () => {
    expect(proximityColor(YELLOW_MAX_M)).toBe('red')
    expect(proximityColor(100)).toBe('red')
  })

  it('returns unknown without a distance', () => {
    expect(proximityColor(undefined)).toBe('unknown')
    expect(proximityColor(Number.NaN)).toBe('unknown')
  })
})

describe('isWithinRadius', () => {
  it('is true at or below the radius', () => {
    expect(isWithinRadius(5, 5)).toBe(true)
    expect(isWithinRadius(4.9, 5)).toBe(true)
  })

  it('is false above the radius or without distance', () => {
    expect(isWithinRadius(5.1, 5)).toBe(false)
    expect(isWithinRadius(undefined, 5)).toBe(false)
  })
})

describe('FoundTracker', () => {
  it('does not fire before the dwell time', () => {
    const t = new FoundTracker(2000)
    expect(t.check('a', true, 0)).toBe(false)
    expect(t.check('a', true, 1999)).toBe(false)
  })

  it('fires once dwell is reached', () => {
    const t = new FoundTracker(2000)
    t.check('a', true, 0)
    expect(t.check('a', true, 2000)).toBe(true)
  })

  it('resets the timer when the tag leaves radius', () => {
    const t = new FoundTracker(2000)
    t.check('a', true, 0)
    t.check('a', true, 1500)
    t.check('a', false, 1600) // leaves radius → reset
    t.check('a', true, 1700) // re-enters → timer restarts
    expect(t.check('a', true, 3600)).toBe(false) // only 1900ms accumulated
    expect(t.check('a', true, 3700)).toBe(true)
  })

  it('tracks tags independently', () => {
    const t = new FoundTracker(2000)
    t.check('a', true, 0)
    t.check('b', true, 1000)
    expect(t.check('a', true, 2000)).toBe(true)
    expect(t.check('b', true, 2000)).toBe(false)
    expect(t.check('b', true, 3000)).toBe(true)
  })

  it('returns false while out of radius', () => {
    const t = new FoundTracker(2000)
    expect(t.check('a', false, 0)).toBe(false)
    expect(t.isTiming('a')).toBe(false)
  })

  it('reset clears one or all timers', () => {
    const t = new FoundTracker(2000)
    t.check('a', true, 0)
    t.check('b', true, 0)
    t.reset('a')
    expect(t.isTiming('a')).toBe(false)
    expect(t.isTiming('b')).toBe(true)
    t.reset()
    expect(t.isTiming('b')).toBe(false)
  })

  it('uses the default dwell constant', () => {
    const t = new FoundTracker()
    t.check('a', true, 0)
    expect(t.check('a', true, FOUND_DWELL_MS - 1)).toBe(false)
    expect(t.check('a', true, FOUND_DWELL_MS)).toBe(true)
  })
})
