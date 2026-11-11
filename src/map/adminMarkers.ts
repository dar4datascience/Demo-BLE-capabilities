import L from 'leaflet'
import type { TagConfig } from '../game/types'
import type { MapMarkerSpec } from './mapService'

/** Admin markers: every configured tag, always visible, neutral style. */
export function buildAdminTagSpecs(tags: TagConfig[]): MapMarkerSpec[] {
  return tags.map((tag) => ({
    key: `admin-${tag.id}`,
    lat: tag.lat,
    lng: tag.lng,
    icon: L.divIcon({
      className: 'admin-tag',
      html: `<span class="admin-tag__dot"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
    tooltip: `${tag.name} · major ${tag.major} minor ${tag.minor}`,
    zIndexOffset: 100,
  }))
}
