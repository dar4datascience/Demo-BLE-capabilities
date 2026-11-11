/** A placed BLE tag as configured by the admin. */
export interface TagConfig {
  /** App-side unique id (slug). */
  id: string
  /** Player-facing name shown in the find list. */
  name: string
  /** iBeacon proximity UUID shared by all tags in a game. */
  uuid: string
  /** iBeacon major — primary radio identifier. */
  major: number
  /** iBeacon minor — secondary radio identifier. */
  minor: number
  /** WGS84 latitude of the tag's physical position. */
  lat: number
  /** WGS84 longitude of the tag's physical position. */
  lng: number
  /** Tag is found when smoothed distance ≤ this (meters). */
  findRadiusM: number
  /** Optional calibrated RSSI@1m override; falls back to iBeacon's advertised value. */
  measuredPowerDbm?: number
}

/** Latest live state for a matched tag. */
export interface LiveDetection {
  /** Smoothed distance estimate in meters (undefined when not currently seen). */
  distanceM?: number
  /** Latest raw RSSI. */
  rssi?: number
  /** Last detection timestamp (ms epoch). */
  lastSeen: number
}

/** An iBeacon heard that doesn't match any configured tag. */
export interface UnknownBeacon {
  uuid: string
  major: number
  minor: number
  rssi: number
  lastSeen: number
  sightings: number
}

export type GameMode = 'player' | 'admin'
