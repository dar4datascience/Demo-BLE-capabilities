/** A single BLE advertisement received from a nearby device. */
export interface BleDetection {
  /** Platform device id (MAC on Android, UUID-ish on web). */
  deviceId: string
  /** Advertised local name, if present. */
  name?: string
  /** Received Signal Strength Indication in dBm. */
  rssi: number
  /** Manufacturer-specific advertisement data keyed by company identifier. */
  manufacturerData: Record<string, DataView>
  /** Service-specific advertisement data keyed by service UUID. */
  serviceData: Record<string, DataView>
  /** Raw advertisement bytes (Android only). */
  rawAdvertisement?: DataView
  /** Detection time, ms since epoch. */
  timestamp: number
}

export type ScanCallback = (detection: BleDetection) => void

export type ScanStatus = 'idle' | 'initializing' | 'scanning' | 'stopping' | 'error' | 'unsupported'
