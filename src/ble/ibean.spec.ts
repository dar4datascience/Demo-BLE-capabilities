import { describe, expect, it } from 'vitest'
import { parseIBeacon } from './ibean'

function hexToDataView(hex: string): DataView {
  const bytes = hex.replace(/\s/g, '')
  const buf = new Uint8Array(bytes.length / 2)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Number.parseInt(bytes.slice(i * 2, i * 2 + 2), 16)
  }
  return new DataView(buf.buffer)
}

// iBeacon payload: type 0x02, len 0x15, uuid B9407F30-F5F8-466E-AFF9-25556B57FE6D,
// major 0x1234, minor 0x5678, measured power -59 dBm (0xC5)
const IBEACON_PAYLOAD = '0215' + 'b9407f30f5f8466eaff925556b57fe6d' + '1234' + '5678' + 'c5'

const EXPECTED = {
  uuid: 'b9407f30-f5f8-466e-aff9-25556b57fe6d',
  major: 0x1234,
  minor: 0x5678,
  measuredPowerDbm: -59,
}

describe('parseIBeacon', () => {
  it('parses a standard iBeacon manufacturer payload (company id stripped)', () => {
    const result = parseIBeacon({ manufacturerData: { '76': hexToDataView(IBEACON_PAYLOAD) } })
    expect(result).toEqual(EXPECTED)
  })

  it('parses when the 2-byte company id is included in the value', () => {
    // 0x004C little-endian inside the payload
    const withCompanyId = '4c00' + IBEACON_PAYLOAD
    const result = parseIBeacon({ manufacturerData: { '76': hexToDataView(withCompanyId) } })
    expect(result).toEqual(EXPECTED)
  })

  it('accepts hex-style company keys', () => {
    const result = parseIBeacon({ manufacturerData: { '0x4c': hexToDataView(IBEACON_PAYLOAD) } })
    expect(result).toEqual(EXPECTED)
  })

  it('returns null for non-iBeacon manufacturer data', () => {
    // Eddystone-ish frame: type 0x10
    const eddystone = '10' + '00'.repeat(20)
    expect(parseIBeacon({ manufacturerData: { '76': hexToDataView(eddystone) } })).toBeNull()
  })

  it('returns null for truncated payloads', () => {
    expect(parseIBeacon({ manufacturerData: { '76': hexToDataView('0215b940') } })).toBeNull()
  })

  it('ignores other manufacturers', () => {
    // Feasycom custom frame company 0xFFF0 (65520)
    const feasycom = '16' + 'fff0' + '01'.repeat(20)
    expect(parseIBeacon({ manufacturerData: { '65520': hexToDataView(feasycom) } })).toBeNull()
  })

  it('parses iBeacon from raw advertisement AD structures', () => {
    // AD structure: len(0x1A=26) type(0xFF) companyLE(4c00) + 23-byte payload
    const ad = '1a' + 'ff' + '4c00' + IBEACON_PAYLOAD
    const result = parseIBeacon({ rawAdvertisement: hexToDataView(ad) })
    expect(result).toEqual(EXPECTED)
  })

  it('handles raw advertisements with preceding AD structures', () => {
    // flags AD (len 2 = type + 1 data byte) then manufacturer AD
    const flags = '02' + '01' + '06'
    const ad = flags + '1a' + 'ff' + '4c00' + IBEACON_PAYLOAD
    const result = parseIBeacon({ rawAdvertisement: hexToDataView(ad) })
    expect(result).toEqual(EXPECTED)
  })

  it('returns null for empty input', () => {
    expect(parseIBeacon({})).toBeNull()
    expect(parseIBeacon({ manufacturerData: {} })).toBeNull()
  })
})
