import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MEASURED_POWER_DBM,
  DistanceTracker,
  MAX_DISTANCE_M,
  MIN_DISTANCE_M,
  PATH_LOSS_EXPONENT,
  rssiToDistanceM,
} from './distance'

describe('rssiToDistanceM', () => {
  it('returns ~1m when rssi equals measured power', () => {
    expect(rssiToDistanceM(-59, -59)).toBeCloseTo(1, 5)
  })

  it('grows with weaker signal', () => {
    const near = rssiToDistanceM(-65, -59)
    const far = rssiToDistanceM(-80, -59)
    expect(far).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(1)
  })

  it('matches the path-loss formula', () => {
    // 10 dB below measured power, n=2.5 → 10^(10/25) ≈ 2.512 m
    const d = rssiToDistanceM(-69, -59)
    expect(d).toBeCloseTo(10 ** (10 / (10 * PATH_LOSS_EXPONENT)), 5)
  })

  it('clamps to MAX for very weak signals', () => {
    expect(rssiToDistanceM(-127, -59)).toBe(MAX_DISTANCE_M)
  })

  it('clamps to MIN for very strong signals', () => {
    expect(rssiToDistanceM(-20, -59)).toBe(MIN_DISTANCE_M)
  })

  it('returns MAX for non-finite input', () => {
    expect(rssiToDistanceM(Number.NaN)).toBe(MAX_DISTANCE_M)
    expect(rssiToDistanceM(Number.POSITIVE_INFINITY)).toBe(MAX_DISTANCE_M)
  })

  it('uses the default measured power when omitted', () => {
    // -59 - (-10n)... rssi -79 is 20dB below -59 → 10^(20/25) ≈ 6.31
    expect(rssiToDistanceM(-79)).toBeCloseTo(10 ** (20 / (10 * PATH_LOSS_EXPONENT)), 5)
    expect(DEFAULT_MEASURED_POWER_DBM).toBe(-59)
  })

  it('respects a custom exponent', () => {
    // n=4 → 20dB down → 10^(20/40) = 3.16 vs n=2.5 → 6.31
    expect(rssiToDistanceM(-79, -59, 4)).toBeCloseTo(10 ** (20 / 40), 5)
  })
})

describe('DistanceTracker', () => {
  it('returns the raw distance on first sample', () => {
    const t = new DistanceTracker(0.3)
    expect(t.update('tag1', 10, 1000)).toBe(10)
    expect(t.get('tag1', 1000)).toBe(10)
  })

  it('smooths subsequent samples with alpha', () => {
    const t = new DistanceTracker(0.5)
    t.update('tag1', 10, 1000)
    // next = 0.5*20 + 0.5*10 = 15
    expect(t.update('tag1', 20, 2000)).toBe(15)
    // next = 0.5*0 + 0.5*15 = 7.5
    expect(t.update('tag1', 0, 3000)).toBe(7.5)
  })

  it('expires stale entries', () => {
    const t = new DistanceTracker(0.3, 1000)
    t.update('tag1', 10, 1000)
    expect(t.get('tag1', 1500)).toBe(10)
    expect(t.get('tag1', 2500)).toBeUndefined()
  })

  it('prune removes stale entries', () => {
    const t = new DistanceTracker(0.3, 1000)
    t.update('tag1', 10, 1000)
    t.update('tag2', 20, 5000)
    t.prune(5000)
    expect(t.get('tag1', 5000)).toBeUndefined()
    expect(t.get('tag2', 5000)).toBe(20)
  })

  it('clear removes all estimates', () => {
    const t = new DistanceTracker()
    t.update('a', 1, 0)
    t.update('b', 2, 0)
    t.clear()
    expect(t.get('a', 0)).toBeUndefined()
    expect(t.get('b', 0)).toBeUndefined()
  })
})
