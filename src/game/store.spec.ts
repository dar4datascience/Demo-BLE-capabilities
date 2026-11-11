import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from './store'
import type { IBeaconData } from '../ble/ibean'
import type { TagConfig } from './types'

const TAG: TagConfig = {
  id: 'tag-a',
  name: 'Bench',
  uuid: 'b9407f30-f5f8-466e-aff9-25556b57fe6d',
  major: 1,
  minor: 1,
  lat: 40.0,
  lng: -73.0,
  findRadiusM: 5,
}

const BEACON: IBeaconData = {
  uuid: TAG.uuid,
  major: TAG.major,
  minor: TAG.minor,
  measuredPowerDbm: -59,
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useGameStore', () => {
  it('seeds default tags when storage is empty', () => {
    const store = useGameStore()
    expect(store.tags.length).toBeGreaterThan(0)
    expect(store.progress.total).toBe(store.tags.length)
  })

  it('matches and records detections for configured tags', () => {
    const store = useGameStore()
    store.importTags([TAG])
    store.ingestIBeacon(BEACON, 3.2, -65, 1000)
    const d = store.detectionFor('tag-a')
    expect(d?.distanceM).toBe(3.2)
    expect(d?.rssi).toBe(-65)
    expect(d?.lastSeen).toBe(1000)
  })

  it('tracks unmatched beacons as unknown', () => {
    const store = useGameStore()
    store.importTags([TAG])
    const other = { ...BEACON, major: 99 }
    store.ingestIBeacon(other, 10, -80, 1000)
    store.ingestIBeacon(other, 9, -81, 2000)
    expect(store.unknownBeacons.size).toBe(1)
    const u = [...store.unknownBeacons.values()][0]
    expect(u.major).toBe(99)
    expect(u.sightings).toBe(2)
    expect(u.lastSeen).toBe(2000)
  })

  it('marks and unmarks found tags', () => {
    const store = useGameStore()
    store.importTags([TAG])
    expect(store.isFound('tag-a')).toBe(false)
    store.markFound('tag-a', 1234)
    expect(store.isFound('tag-a')).toBe(true)
    expect(store.foundAt.get('tag-a')).toBe(1234)
    store.unmarkFound('tag-a')
    expect(store.isFound('tag-a')).toBe(false)
  })

  it('clears detections without touching config', () => {
    const store = useGameStore()
    store.importTags([TAG])
    store.ingestIBeacon(BEACON, 3, -60, 1)
    store.clearDetections()
    expect(store.detectionFor('tag-a')).toBeUndefined()
    expect(store.tags).toHaveLength(1)
  })

  it('resetProgress clears found state but keeps tags', () => {
    const store = useGameStore()
    store.importTags([TAG])
    store.markFound('tag-a')
    store.resetProgress()
    expect(store.isFound('tag-a')).toBe(false)
    expect(store.tags).toHaveLength(1)
  })

  it('evaluateFound marks a tag after sustained proximity', () => {
    const store = useGameStore()
    store.importTags([{ ...TAG, findRadiusM: 5 }])
    store.ingestIBeacon(BEACON, 3, -60, 1000)
    store.evaluateFound(1000)
    expect(store.isFound('tag-a')).toBe(false)
    store.evaluateFound(3000) // 2000ms dwell reached
    expect(store.isFound('tag-a')).toBe(true)
  })

  it('evaluateFound ignores stale detections', () => {
    const store = useGameStore()
    store.importTags([{ ...TAG, findRadiusM: 5 }])
    store.ingestIBeacon(BEACON, 3, -60, 1000)
    store.evaluateFound(1000)
    // detection goes stale (>2500ms) before dwell completes
    store.evaluateFound(4000)
    expect(store.isFound('tag-a')).toBe(false)
  })

  it('evaluateFound requires distance within radius', () => {
    const store = useGameStore()
    store.importTags([{ ...TAG, findRadiusM: 5 }])
    store.ingestIBeacon(BEACON, 8, -70, 1000) // outside 5m radius
    store.evaluateFound(1000)
    store.evaluateFound(5000)
    expect(store.isFound('tag-a')).toBe(false)
  })

  it('persists tags and found state to localStorage', async () => {
    const store = useGameStore()
    store.importTags([TAG])
    store.markFound('tag-a', 42)
    await new Promise((r) => setTimeout(r, 0))

    setActivePinia(createPinia())
    const store2 = useGameStore()
    expect(store2.tags.map((t) => t.id)).toContain('tag-a')
    expect(store2.isFound('tag-a')).toBe(true)
  })
})
