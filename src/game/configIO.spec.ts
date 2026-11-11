import { describe, expect, it } from 'vitest'
import { ConfigError, exportConfig, parseConfig, provisioningSheet, validateTags } from './configIO'
import type { TagConfig } from './types'

const TAG: TagConfig = {
  id: 'tag-a',
  name: 'Bench',
  uuid: 'b9407f30-f5f8-466e-aff9-25556b57fe6d',
  major: 1,
  minor: 2,
  lat: 40.1,
  lng: -73.2,
  findRadiusM: 5,
  measuredPowerDbm: -61,
}

describe('validateTags', () => {
  it('accepts a bare array', () => {
    expect(validateTags([TAG])).toEqual([TAG])
  })

  it('accepts { tags: [...] } wrapper and strips extras', () => {
    const out = validateTags({ tags: [{ ...TAG, extra: 'ignored' }] })
    expect(out).toHaveLength(1)
    expect(out[0]).not.toHaveProperty('extra')
  })

  it('rejects non-array input', () => {
    expect(() => validateTags({ foo: 1 })).toThrow(ConfigError)
    expect(() => validateTags('nope')).toThrow(ConfigError)
  })

  it('rejects missing required fields', () => {
    const { name: _omit, ...rest } = TAG
    expect(() => validateTags([rest])).toThrow(/name/)
  })

  it('rejects out-of-range values', () => {
    expect(() => validateTags([{ ...TAG, major: 70000 }])).toThrow(ConfigError)
    expect(() => validateTags([{ ...TAG, lat: 91 }])).toThrow(ConfigError)
    expect(() => validateTags([{ ...TAG, findRadiusM: 0 }])).toThrow(ConfigError)
  })

  it('rejects duplicate ids', () => {
    expect(() => validateTags([TAG, TAG])).toThrow(/duplicate/)
  })

  it('keeps optional measuredPowerDbm when valid', () => {
    const out = validateTags([{ ...TAG, measuredPowerDbm: -70 }])
    expect(out[0].measuredPowerDbm).toBe(-70)
  })
})

describe('exportConfig / parseConfig', () => {
  it('round-trips tags through JSON', () => {
    const json = exportConfig([TAG])
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parseConfig(json)).toEqual([TAG])
  })

  it('parseConfig rejects invalid JSON and bad shapes', () => {
    expect(() => parseConfig('{bad')).toThrow(ConfigError)
    expect(() => parseConfig('{"version":1,"tags":"x"}')).toThrow(ConfigError)
  })
})

describe('provisioningSheet', () => {
  it('emits a CSV header and one row per tag', () => {
    const csv = provisioningSheet([TAG])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('name,uuid,major,minor,findRadiusM,measuredPowerDbm')
    expect(lines[1]).toBe('Bench,b9407f30-f5f8-466e-aff9-25556b57fe6d,1,2,5,-61')
  })

  it('leaves measuredPowerDbm empty when unset', () => {
    const { measuredPowerDbm: _omit, ...noMp } = TAG
    const csv = provisioningSheet([noMp])
    expect(csv.trim().split('\n')[1].endsWith(',')).toBe(true)
  })
})
