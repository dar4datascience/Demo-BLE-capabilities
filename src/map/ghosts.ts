import L from 'leaflet'
import { isDetectionFresh, proximityColor } from '../game/logic'
import type { LiveDetection, TagConfig } from '../game/types'
import type { MapMarkerSpec } from './mapService'

/**
 * Ghost markers: one per *currently detected* tag, at its configured position.
 * Color reflects proximity; found tags get a permanent labeled style.
 * Undetected tags produce no marker (fog of war).
 */

const ICON_SIZE = 44

/** Escape user-controlled text before interpolating into divIcon HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ghostIcon(color: string, found: boolean, label: string): L.DivIcon {
  const state = found ? 'found' : color
  const inner = found
    ? `<span class="ghost__dist ghost__dist--found">✓ ${escapeHtml(label)}</span>`
    : `<span class="ghost__dist">${escapeHtml(label)}</span>`
  return L.divIcon({
    className: `ghost ghost--${state}`,
    html: `<span class="ghost__ring"></span><span class="ghost__dot"></span>${inner}`,
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
  })
}

export function buildGhostSpecs(
  tags: TagConfig[],
  detections: ReadonlyMap<string, LiveDetection>,
  isFound: (tagId: string) => boolean,
  now: number = Date.now(),
): MapMarkerSpec[] {
  const specs: MapMarkerSpec[] = []
  for (const tag of tags) {
    const d = detections.get(tag.id)
    if (!d || !isDetectionFresh(d.lastSeen, now)) continue

    const found = isFound(tag.id)
    const color = proximityColor(d.distanceM)
    const distLabel = d.distanceM !== undefined ? `${Math.round(d.distanceM)}m` : '…'

    specs.push({
      key: `ghost-${tag.id}`,
      lat: tag.lat,
      lng: tag.lng,
      icon: ghostIcon(color, found, found ? tag.name : distLabel),
      tooltip: found ? `${tag.name} — found` : undefined,
      zIndexOffset: found ? 500 : 0,
    })
  }
  return specs
}
