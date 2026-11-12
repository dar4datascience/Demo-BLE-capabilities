import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapMarkerSpec {
  key: string
  lat: number
  lng: number
  icon: L.DivIcon
  /** Permanent tooltip text (empty = none). */
  tooltip?: string
  opacity?: number
  zIndexOffset?: number
}

export interface MapClickHandler {
  (lat: number, lng: number): void
}

const DEFAULT_CENTER: [number, number] = [20, 0]
const DEFAULT_ZOOM = 2

/**
 * Owns the Leaflet map instance and its marker layer. Views never touch
 * Leaflet directly — all map access goes through this service.
 */
export class GameMapService {
  readonly map: L.Map
  private readonly markerLayer = L.layerGroup()
  private readonly markers = new Map<string, L.Marker>()
  private clickHandlers: MapClickHandler[] = []

  constructor(container: HTMLElement) {
    this.map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map)
    this.markerLayer.addTo(this.map)
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      for (const h of this.clickHandlers) h(e.latlng.lat, e.latlng.lng)
    })
    this.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  }

  /** Frame the given points; falls back to a medium world view when empty. */
  fitToPoints(points: Array<[number, number]>, padding = 60): void {
    if (points.length === 0) {
      this.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }
    if (points.length === 1) {
      this.map.setView(points[0], 17)
      return
    }
    this.map.fitBounds(L.latLngBounds(points), { padding: [padding, padding] })
  }

  /** Add or update a click handler; returns an unsubscribe function. */
  onMapClick(handler: MapClickHandler): () => void {
    this.clickHandlers.push(handler)
    return () => {
      this.clickHandlers = this.clickHandlers.filter((h) => h !== handler)
    }
  }

  /**
   * Reconcile markers with the desired set: adds new, updates moved/styled
   * existing, removes missing. Keys are stable ids (e.g. tag.id).
   */
  syncMarkers(specs: Iterable<MapMarkerSpec>): void {
    const desired = new Map<string, MapMarkerSpec>()
    for (const s of specs) desired.set(s.key, s)

    for (const [key, marker] of this.markers) {
      if (!desired.has(key)) {
        this.markerLayer.removeLayer(marker)
        this.markers.delete(key)
      }
    }

    for (const [key, spec] of desired) {
      const existing = this.markers.get(key)
      if (existing) {
        existing.setLatLng([spec.lat, spec.lng])
        existing.setIcon(spec.icon)
        existing.setOpacity(spec.opacity ?? 1)
        if (spec.zIndexOffset !== undefined) existing.setZIndexOffset(spec.zIndexOffset)
        if (spec.tooltip !== undefined) existing.setTooltipContent(spec.tooltip)
      } else {
        const marker = L.marker([spec.lat, spec.lng], {
          icon: spec.icon,
          opacity: spec.opacity ?? 1,
          zIndexOffset: spec.zIndexOffset ?? 0,
        })
        if (spec.tooltip) marker.bindTooltip(spec.tooltip, { permanent: true, direction: 'top' })
        marker.addTo(this.markerLayer)
        this.markers.set(key, marker)
      }
    }
  }

  clearMarkers(): void {
    this.markerLayer.clearLayers()
    this.markers.clear()
  }

  /** Smoothly pan/zoom to a point (e.g. after a GPS fix). */
  flyTo(lat: number, lng: number, zoom = 18): void {
    this.map.flyTo([lat, lng], zoom, { duration: 0.8 })
  }

  invalidateSize(): void {
    this.map.invalidateSize()
  }

  destroy(): void {
    this.map.remove()
    this.markers.clear()
    this.clickHandlers = []
  }
}
