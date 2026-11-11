import { onScopeDispose } from 'vue'
import { parseIBeacon } from '../ble/ibean'
import { BleUnavailableError, isScanning, startScan, stopScan } from '../ble/bleScan'
import { DistanceTracker, rssiToDistanceM } from '../ble/distance'
import { buildGhostSpecs } from '../map/ghosts'
import type { GameMapService } from '../map/mapService'
import { beaconKey, matchTag, useGameStore } from './store'

const GHOST_REFRESH_MS = 300

/**
 * Scan pipeline: BLE advertisement → iBeacon parse → distance estimate →
 * store ingest → periodic found-evaluation + ghost marker refresh.
 * Used by PlayerView; AdminView doesn't scan.
 */
export function useBeaconScanner() {
  const store = useGameStore()
  const tracker = new DistanceTracker()
  let ghostTimer: ReturnType<typeof setInterval> | undefined
  let mapService: GameMapService | null = null

  function refreshGhosts(): void {
    store.evaluateFound()
    tracker.prune()
    if (mapService) {
      mapService.syncMarkers(buildGhostSpecs(store.tags, store.detections, store.isFound))
    }
  }

  /** Attach the map service so ghost markers can be synced. */
  function bindMap(service: GameMapService): void {
    mapService = service
  }

  async function start(): Promise<void> {
    if (store.scanning || isScanning()) return
    store.scanError = null
    store.scanning = true
    try {
      await startScan((detection) => {
        const beacon = parseIBeacon(detection)
        if (!beacon) return
        const tag = matchTag(store.tags, beacon)
        const measuredPower = tag?.measuredPowerDbm ?? beacon.measuredPowerDbm
        const rawDistance = rssiToDistanceM(detection.rssi, measuredPower)
        const key = beaconKey(beacon.uuid, beacon.major, beacon.minor)
        const smoothed = tracker.update(key, rawDistance)
        store.ingestIBeacon(beacon, smoothed, detection.rssi)
      })
      ghostTimer = setInterval(refreshGhosts, GHOST_REFRESH_MS)
    } catch (e) {
      store.scanning = false
      store.scanError =
        e instanceof BleUnavailableError
          ? e.message
          : `Scan failed: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  async function stop(): Promise<void> {
    if (ghostTimer !== undefined) {
      clearInterval(ghostTimer)
      ghostTimer = undefined
    }
    await stopScan()
    tracker.clear()
    store.clearDetections()
    if (mapService) mapService.syncMarkers([])
    store.scanning = false
  }

  onScopeDispose(() => {
    void stop()
  })

  return { start, stop, refreshGhosts, bindMap }
}
