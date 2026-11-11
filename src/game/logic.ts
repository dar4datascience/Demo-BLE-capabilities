/**
 * Pure game rules: proximity color bands and the found-condition dwell check.
 * No framework imports — unit-tested in isolation.
 */

/** Proximity bands in meters: < GREEN_MAX green, < YELLOW_MAX yellow, else red. */
export const GREEN_MAX_M = 10
export const YELLOW_MAX_M = 30

/** A tag must stay within its find radius this long to count as found. */
export const FOUND_DWELL_MS = 2000

/** A detection older than this is treated as "no longer seen". */
export const DETECTION_FRESH_MS = 2500

export type ProximityColor = 'green' | 'yellow' | 'red' | 'unknown'

/** Color band for a smoothed distance; 'unknown' when no estimate exists. */
export function proximityColor(distanceM: number | undefined): ProximityColor {
  if (distanceM === undefined || !Number.isFinite(distanceM)) return 'unknown'
  if (distanceM < GREEN_MAX_M) return 'green'
  if (distanceM < YELLOW_MAX_M) return 'yellow'
  return 'red'
}

/** Whether a distance estimate satisfies a tag's find radius. */
export function isWithinRadius(distanceM: number | undefined, findRadiusM: number): boolean {
  return distanceM !== undefined && distanceM <= findRadiusM
}

/** Whether a detection timestamp is recent enough to count as "seen". */
export function isDetectionFresh(lastSeen: number, now: number = Date.now()): boolean {
  return now - lastSeen <= DETECTION_FRESH_MS
}

/**
 * Tracks how long each tag has been continuously within its find radius.
 * `check` returns true exactly when the dwell threshold is first reached;
 * stepping out of radius resets that tag's timer.
 */
export class FoundTracker {
  private withinSince = new Map<string, number>()
  private readonly dwellMs: number

  constructor(dwellMs = FOUND_DWELL_MS) {
    this.dwellMs = dwellMs
  }

  /**
   * Feed the current within-radius state for a tag.
   * Returns true once the tag has remained within radius for `dwellMs`.
   */
  check(tagId: string, withinRadius: boolean, now: number = Date.now()): boolean {
    if (!withinRadius) {
      this.withinSince.delete(tagId)
      return false
    }
    const since = this.withinSince.get(tagId) ?? now
    this.withinSince.set(tagId, since)
    return now - since >= this.dwellMs
  }

  /** Whether the tag is currently accumulating dwell time. */
  isTiming(tagId: string): boolean {
    return this.withinSince.has(tagId)
  }

  reset(tagId?: string): void {
    if (tagId === undefined) this.withinSince.clear()
    else this.withinSince.delete(tagId)
  }
}
