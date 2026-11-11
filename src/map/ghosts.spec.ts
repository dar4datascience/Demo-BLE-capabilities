import { describe, expect, it } from 'vitest'
import { buildGhostSpecs } from './ghosts'
import type { LiveDetection, TagConfig } from '../game/types'

const TAGS: TagConfig[] = [
  {
    id: 'a',
    name: 'Alpha',
    uuid: 'u',
    major: 1,
    minor: 1,
    lat: 1,
    lng: 1,
    findRadiusM: 5,
  },
  {
    id: 'b',
    name: 'Beta',
    uuid: 'u',
    major: 2,
    minor: 1,
    lat: 2,
    lng: 2,
    findRadiusM: 5,
  },
]

function det(distanceM: number | undefined, lastSeen = 10_000): LiveDetection {
  return { distanceM, rssi: -60, lastSeen }
}

describe('buildGhostSpecs', () => {
  it('returns no markers when nothing is detected', () => {
    expect(buildGhostSpecs(TAGS, new Map(), () => false, 10_000)).toHaveLength(0)
  })

  it('emits a marker per fresh detection at the tag position', () => {
    const detections = new Map([
      ['a', det(4)],
      ['b', det(20)],
    ])
    const specs = buildGhostSpecs(TAGS, detections, () => false, 10_000)
    expect(specs).toHaveLength(2)
    expect(specs[0].key).toBe('ghost-a')
    expect([specs[0].lat, specs[0].lng]).toEqual([1, 1])
    expect(specs[1].key).toBe('ghost-b')
  })

  it('skips stale detections (fog of war)', () => {
    const detections = new Map([['a', det(4, 0)]])
    // lastSeen 0, now 10_000 → age 10s > DETECTION_FRESH_MS
    expect(buildGhostSpecs(TAGS, detections, () => false, 10_000)).toHaveLength(0)
  })

  it('colors icons by proximity band', () => {
    const detections = new Map([
      ['a', det(5)], // green
      ['b', det(20)], // yellow
    ])
    const specs = buildGhostSpecs(TAGS, detections, () => false, 10_000)
    const classOf = (s: (typeof specs)[0]) => s.icon.options.className
    expect(classOf(specs[0])).toContain('ghost--green')
    expect(classOf(specs[1])).toContain('ghost--yellow')
  })

  it('found tags get the found style and name label', () => {
    const detections = new Map([['a', det(3)]])
    const specs = buildGhostSpecs(TAGS, detections, (id) => id === 'a', 10_000)
    expect(specs).toHaveLength(1)
    expect(specs[0].icon.options.className).toContain('ghost--found')
    expect(specs[0].icon.options.html).toContain('Alpha')
    expect(specs[0].zIndexOffset).toBe(500)
  })

  it('unfound ghosts show distance, not name', () => {
    const detections = new Map([['a', det(12.4)]])
    const specs = buildGhostSpecs(TAGS, detections, () => false, 10_000)
    expect(specs[0].icon.options.html).toContain('12m')
    expect(specs[0].icon.options.html).not.toContain('Alpha')
  })
})
