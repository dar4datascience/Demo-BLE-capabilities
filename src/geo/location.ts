import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

/** A single GPS fix in the shape the tag form needs. */
export interface GpsFix {
  lat: number
  lng: number
  /** Horizontal accuracy radius in meters (smaller = better). */
  accuracyM: number
}

/**
 * Acquire the device's current position.
 *
 * On Android (Capacitor native) runtime permissions are requested first —
 * the plugin's manifest does not declare them and getCurrentPosition does
 * not prompt on its own. In the browser the plugin falls back to the
 * Geolocation API, which shows its own permission prompt, so we skip the
 * native permission dance there (`requestPermissions` is unimplemented on
 * web and `navigator.permissions` may be unavailable on insecure origins).
 */
export async function getCurrentPosition(): Promise<GpsFix> {
  if (Capacitor.isNativePlatform()) {
    await ensureLocationPermission()
  }

  let position
  try {
    position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    })
  } catch (err) {
    throw new Error(describeLocationError(err), { cause: err })
  }

  const { latitude, longitude, accuracy } = position.coords
  return { lat: latitude, lng: longitude, accuracyM: accuracy }
}

async function ensureLocationPermission(): Promise<void> {
  const current = await Geolocation.checkPermissions()
  if (current.location === 'granted') return
  const requested = await Geolocation.requestPermissions()
  if (requested.location !== 'granted') {
    throw new Error('Location permission denied — enable it in system settings and try again.')
  }
}

/** Map raw Geolocation/DOMException failures to a user-readable message. */
function describeLocationError(err: unknown): string {
  const code = (err as { code?: number })?.code
  switch (code) {
    case 1:
      return 'Location permission denied.'
    case 2:
      return 'Location unavailable — check that GPS/location services are on.'
    case 3:
      return 'GPS fix timed out — try again outdoors or near a window.'
    default:
      return err instanceof Error ? err.message : 'Could not get your location.'
  }
}
