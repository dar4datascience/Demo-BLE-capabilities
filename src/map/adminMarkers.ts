import L from 'leaflet'
import type { TagConfig } from '../game/types'
import { escapeHtml } from './ghosts'
import type { MapMarkerSpec } from './mapService'

const ICON_SIZE = 44

/**
 * Admin markers: every configured tag, always visible. Same ghost visual
 * language as player detections (pulse ring + dot + label) but in amber —
 * a configured location, not a live proximity reading.
 */
export function buildAdminTagSpecs(tags: TagConfig[]): MapMarkerSpec[] {
  return tags.map((tag) => ({
    key: `admin-${tag.id}`,
    lat: tag.lat,
    lng: tag.lng,
    icon: L.divIcon({
      className: 'ghost ghost--admin',
      html: `<span class="ghost__ring"></span><span class="ghost__dot"></span><span class="ghost__dist ghost__dist--admin">${escapeHtml(tag.name)}</span>`,
      iconSize: [ICON_SIZE, ICON_SIZE],
      iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
    }),
    tooltip: `${tag.name} · major ${tag.major} minor ${tag.minor}`,
    zIndexOffset: 100,
  }))
}
