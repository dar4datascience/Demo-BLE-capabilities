import type { TagConfig } from './types'

/** Game config file payload version. */
export const CONFIG_VERSION = 1

export interface GameConfigFile {
  version: number
  tags: TagConfig[]
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function reqString(o: Record<string, unknown>, key: string): string {
  const v = o[key]
  if (typeof v !== 'string' || v.length === 0) {
    throw new ConfigError(`tag.${key} must be a non-empty string`)
  }
  return v
}

function reqNumber(o: Record<string, unknown>, key: string, min?: number, max?: number): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ConfigError(`tag.${key} must be a finite number`)
  }
  if (min !== undefined && v < min) throw new ConfigError(`tag.${key} must be >= ${min}`)
  if (max !== undefined && v > max) throw new ConfigError(`tag.${key} must be <= ${max}`)
  return v
}

/** Validate untrusted JSON into TagConfig[]. Throws ConfigError on bad data. */
export function validateTags(input: unknown): TagConfig[] {
  const list = Array.isArray(input)
    ? input
    : isObj(input) && Array.isArray(input.tags)
      ? input.tags
      : null
  if (!list) throw new ConfigError('config must be an array of tags or { tags: [...] }')

  const seenIds = new Set<string>()
  return list.map((raw, i) => {
    if (!isObj(raw)) throw new ConfigError(`tag[${i}] must be an object`)
    const tag: TagConfig = {
      id: reqString(raw, 'id'),
      name: reqString(raw, 'name'),
      uuid: reqString(raw, 'uuid'),
      major: reqNumber(raw, 'major', 0, 65535),
      minor: reqNumber(raw, 'minor', 0, 65535),
      lat: reqNumber(raw, 'lat', -90, 90),
      lng: reqNumber(raw, 'lng', -180, 180),
      findRadiusM: reqNumber(raw, 'findRadiusM', 0.5, 100),
    }
    if (raw.measuredPowerDbm !== undefined) {
      tag.measuredPowerDbm = reqNumber(raw, 'measuredPowerDbm', -127, 20)
    }
    if (seenIds.has(tag.id)) throw new ConfigError(`duplicate tag id "${tag.id}"`)
    seenIds.add(tag.id)
    return tag
  })
}

/** Serialize tags to a downloadable config JSON string. */
export function exportConfig(tags: TagConfig[]): string {
  const file: GameConfigFile = { version: CONFIG_VERSION, tags }
  return JSON.stringify(file, null, 2)
}

/** Parse + validate a config JSON string. */
export function parseConfig(json: string): TagConfig[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new ConfigError('invalid JSON')
  }
  return validateTags(data)
}

/** Read a File into validated tags. */
export function readConfigFile(file: File): Promise<TagConfig[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(parseConfig(String(reader.result)))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(new ConfigError('failed to read file'))
    reader.readAsText(file)
  })
}

/** Trigger a browser download of the config JSON. */
export function downloadConfig(tags: TagConfig[], filename = 'tagtrail-config.json'): void {
  downloadText(exportConfig(tags), filename, 'application/json')
}

/**
 * Provisioning sheet: CSV the admin uses when programming each FSC-BP108 in
 * the FeasyBeacon app — one row per tag with its iBeacon fields.
 */
export function provisioningSheet(tags: TagConfig[]): string {
  const rows = tags.map((t) =>
    [t.name, t.uuid, t.major, t.minor, t.findRadiusM, t.measuredPowerDbm ?? ''].join(','),
  )
  return ['name,uuid,major,minor,findRadiusM,measuredPowerDbm', ...rows].join('\n') + '\n'
}

export function downloadProvisioningSheet(tags: TagConfig[]): void {
  downloadText(provisioningSheet(tags), 'tagtrail-provisioning.csv', 'text/csv')
}

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
