/** Identity extracted from an iBeacon advertisement frame. */
export interface IBeaconData {
  /** Proximity UUID, canonical lowercase 8-4-4-4-12. */
  uuid: string
  /** iBeacon major — our per-tag identifier. */
  major: number
  /** iBeacon minor — secondary identifier. */
  minor: number
  /** Measured power: RSSI in dBm expected at 1 meter (signed). */
  measuredPowerDbm: number
}

/** Minimal advertisement shape the parser needs (structural, not BleDetection). */
export interface AdvertisementLike {
  manufacturerData?: Record<string, DataView>
  rawAdvertisement?: DataView
}

const APPLE_COMPANY_ID = 0x004c
const IBEACON_TYPE = 0x02
const IBEACON_LENGTH = 0x15
const IBEACON_PAYLOAD_SIZE = 23 // type(1) + len(1) + uuid(16) + major(2) + minor(2) + txpower(1)
const MANUFACTURER_SPECIFIC_AD_TYPE = 0xff

function companyKeyToId(key: string): number | null {
  const dec = Number(key)
  if (Number.isInteger(dec)) return dec
  const hex = key.startsWith('0x') || key.startsWith('0X') ? key.slice(2) : key
  const parsed = Number.parseInt(hex, 16)
  return Number.isNaN(parsed) ? null : parsed
}

function parseUuid(dv: DataView, offset: number): string {
  const bytes: string[] = []
  for (let i = 0; i < 16; i++) {
    bytes.push(
      dv
        .getUint8(offset + i)
        .toString(16)
        .padStart(2, '0'),
    )
  }
  const hex = bytes.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Parse an iBeacon payload starting at `offset` inside `dv`. */
function parsePayloadAt(dv: DataView, offset: number): IBeaconData | null {
  if (dv.byteLength - offset < IBEACON_PAYLOAD_SIZE) return null
  if (dv.getUint8(offset) !== IBEACON_TYPE || dv.getUint8(offset + 1) !== IBEACON_LENGTH) {
    return null
  }
  return {
    uuid: parseUuid(dv, offset + 2),
    major: dv.getUint16(offset + 18),
    minor: dv.getUint16(offset + 20),
    measuredPowerDbm: dv.getInt8(offset + 22),
  }
}

/**
 * Try offsets 0 and 2 — some stacks include the 2-byte company id inside the
 * manufacturer data value, others (Android plugin, Web Bluetooth) strip it.
 */
function parseManufacturerPayload(dv: DataView): IBeaconData | null {
  return parsePayloadAt(dv, 0) ?? parsePayloadAt(dv, 2)
}

/** Fallback: walk raw AD structures (len/type/data) for an Apple iBeacon frame. */
function parseRawAdvertisement(raw: DataView): IBeaconData | null {
  let i = 0
  while (i + 1 < raw.byteLength) {
    const len = raw.getUint8(i)
    if (len === 0) break
    const type = raw.getUint8(i + 1)
    const dataStart = i + 2
    const dataEnd = dataStart + len - 1
    if (dataEnd > raw.byteLength) break

    if (type === MANUFACTURER_SPECIFIC_AD_TYPE && len >= 4) {
      // Company id is little-endian inside the AD payload.
      const companyId = raw.getUint8(dataStart) | (raw.getUint8(dataStart + 1) << 8)
      if (companyId === APPLE_COMPANY_ID) {
        // Re-wrap payload (after company id) as a DataView for the shared parser.
        const payload = new DataView(
          raw.buffer,
          raw.byteOffset + dataStart + 2,
          dataEnd - dataStart - 2,
        )
        const parsed = parseManufacturerPayload(payload)
        if (parsed) return parsed
      }
    }
    i = dataStart + len - 1
  }
  return null
}

/**
 * Extract iBeacon identity from a BLE advertisement.
 * Returns null when the advertisement is not an iBeacon frame.
 */
export function parseIBeacon(ad: AdvertisementLike): IBeaconData | null {
  if (ad.manufacturerData) {
    for (const [key, dv] of Object.entries(ad.manufacturerData)) {
      if (companyKeyToId(key) !== APPLE_COMPANY_ID) continue
      const parsed = parseManufacturerPayload(dv)
      if (parsed) return parsed
    }
  }
  if (ad.rawAdvertisement) {
    return parseRawAdvertisement(ad.rawAdvertisement)
  }
  return null
}
