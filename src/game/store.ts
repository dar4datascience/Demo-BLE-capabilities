import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type { IBeaconData } from '../ble/ibean'
import defaultGame from '../config/defaultGame.json'
import { FoundTracker, isDetectionFresh, isWithinRadius } from './logic'
import type { GameMode, LiveDetection, TagConfig, UnknownBeacon } from './types'

const TAGS_KEY = 'tagtrail.tags.v1'
const FOUND_KEY = 'tagtrail.found.v1'
const MAX_UNKNOWN_BEACONS = 50

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full / unavailable — non-fatal
  }
}

/** Stable identity of a radio beacon. */
export function beaconKey(uuid: string, major: number, minor: number): string {
  return `${uuid}:${major}:${minor}`
}

/** Find the configured tag matching an iBeacon identity, if any. */
export function matchTag(tags: TagConfig[], beacon: IBeaconData): TagConfig | undefined {
  return tags.find(
    (t) => t.uuid === beacon.uuid && t.major === beacon.major && t.minor === beacon.minor,
  )
}

export const useGameStore = defineStore('game', () => {
  const tags = ref<TagConfig[]>(loadJson<TagConfig[]>(TAGS_KEY) ?? defaultGame.tags)
  const detections = reactive(new Map<string, LiveDetection>())
  const foundAt = reactive(new Map<string, number>())
  const unknownBeacons = reactive(new Map<string, UnknownBeacon>())
  const mode = ref<GameMode>('player')
  const scanning = ref(false)
  const scanError = ref<string | null>(null)
  const foundTracker = new FoundTracker()

  const found = computed(() => tags.value.filter((t) => foundAt.has(t.id)))
  const progress = computed(() => ({ found: found.value.length, total: tags.value.length }))

  watch(tags, (v) => saveJson(TAGS_KEY, v), { deep: true })
  watch(
    () => Array.from(foundAt.entries()),
    (entries) => saveJson(FOUND_KEY, Object.fromEntries(entries)),
    { deep: true },
  )

  // Restore found state once at store creation.
  const savedFound = loadJson<Record<string, number>>(FOUND_KEY)
  if (savedFound) {
    for (const [id, ts] of Object.entries(savedFound)) foundAt.set(id, ts)
  }

  function detectionFor(tagId: string): LiveDetection | undefined {
    return detections.get(tagId)
  }

  function isFound(tagId: string): boolean {
    return foundAt.has(tagId)
  }

  /**
   * Feed a parsed iBeacon + smoothed distance into the store.
   * Matches against configured tags; unmatched beacons are tracked for the
   * admin "discovered devices" list.
   */
  function ingestIBeacon(
    beacon: IBeaconData,
    distanceM: number | undefined,
    rssi: number,
    now = Date.now(),
  ): void {
    const tag = matchTag(tags.value, beacon)
    if (tag) {
      detections.set(tag.id, { distanceM, rssi, lastSeen: now })
    } else {
      const key = beaconKey(beacon.uuid, beacon.major, beacon.minor)
      const prev = unknownBeacons.get(key)
      unknownBeacons.set(key, {
        uuid: beacon.uuid,
        major: beacon.major,
        minor: beacon.minor,
        rssi,
        lastSeen: now,
        sightings: (prev?.sightings ?? 0) + 1,
      })
      if (unknownBeacons.size > MAX_UNKNOWN_BEACONS) {
        const oldest = [...unknownBeacons.entries()].sort(
          (a, b) => a[1].lastSeen - b[1].lastSeen,
        )[0]
        if (oldest) unknownBeacons.delete(oldest[0])
      }
    }
  }

  /** Mark a tag found (called by the found-rule evaluator). */
  function markFound(tagId: string, now = Date.now()): void {
    if (!foundAt.has(tagId)) foundAt.set(tagId, now)
  }

  function unmarkFound(tagId: string): void {
    foundAt.delete(tagId)
    foundTracker.reset(tagId)
  }

  /** Clear live detections + unknown beacons (e.g. scan stopped). */
  function clearDetections(): void {
    detections.clear()
    unknownBeacons.clear()
    foundTracker.reset()
  }

  /**
   * Evaluate the found rule for every tag: fresh detection within the tag's
   * find radius, sustained for the dwell period. Call after each ingest batch
   * or on an interval while scanning.
   */
  function evaluateFound(now = Date.now()): void {
    for (const tag of tags.value) {
      if (foundAt.has(tag.id)) continue
      const d = detections.get(tag.id)
      const within =
        d !== undefined &&
        isDetectionFresh(d.lastSeen, now) &&
        isWithinRadius(d.distanceM, tag.findRadiusM)
      if (foundTracker.check(tag.id, within, now)) markFound(tag.id, now)
    }
  }

  /** Reset found progress only — tags and config stay. */
  function resetProgress(): void {
    foundAt.clear()
    foundTracker.reset()
    saveJson(FOUND_KEY, {})
  }

  /** Wipe everything back to the bundled default game. */
  function resetAll(): void {
    tags.value = defaultGame.tags
    detections.clear()
    foundAt.clear()
    unknownBeacons.clear()
    saveJson(TAGS_KEY, defaultGame.tags)
    saveJson(FOUND_KEY, {})
  }

  function upsertTag(tag: TagConfig): void {
    const idx = tags.value.findIndex((t) => t.id === tag.id)
    if (idx >= 0) tags.value[idx] = tag
    else tags.value.push(tag)
  }

  function removeTag(tagId: string): void {
    tags.value = tags.value.filter((t) => t.id !== tagId)
    detections.delete(tagId)
    foundAt.delete(tagId)
  }

  function importTags(imported: TagConfig[]): void {
    tags.value = imported
  }

  return {
    tags,
    detections,
    foundAt,
    unknownBeacons,
    mode,
    scanning,
    scanError,
    found,
    progress,
    detectionFor,
    isFound,
    ingestIBeacon,
    markFound,
    unmarkFound,
    clearDetections,
    evaluateFound,
    resetProgress,
    resetAll,
    upsertTag,
    removeTag,
    importTags,
  }
})
