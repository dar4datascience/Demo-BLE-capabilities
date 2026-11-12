import { beforeEach, describe, expect, it, vi } from 'vitest'

const isNativePlatform = vi.fn()
const checkPermissions = vi.fn()
const requestPermissions = vi.fn()
const getCurrentPositionNative = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}))

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    getCurrentPosition: (opts: unknown) => getCurrentPositionNative(opts),
  },
}))

import { getCurrentPosition } from './location'

const FIX = {
  timestamp: 0,
  coords: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 8,
    altitudeAccuracy: null,
    altitude: null,
    speed: null,
    heading: null,
  },
}

describe('getCurrentPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isNativePlatform.mockReturnValue(false)
    checkPermissions.mockResolvedValue({ location: 'granted' })
    getCurrentPositionNative.mockResolvedValue(FIX)
  })

  it('returns lat/lng/accuracy from the plugin position', async () => {
    await expect(getCurrentPosition()).resolves.toEqual({
      lat: 37.7749,
      lng: -122.4194,
      accuracyM: 8,
    })
  })

  it('requests high-accuracy options', async () => {
    await getCurrentPosition()
    expect(getCurrentPositionNative).toHaveBeenCalledWith(
      expect.objectContaining({ enableHighAccuracy: true }),
    )
  })

  it('skips permission checks on web', async () => {
    await getCurrentPosition()
    expect(checkPermissions).not.toHaveBeenCalled()
    expect(requestPermissions).not.toHaveBeenCalled()
  })

  it('requests permission on native when not granted', async () => {
    isNativePlatform.mockReturnValue(true)
    checkPermissions.mockResolvedValue({ location: 'prompt' })
    requestPermissions.mockResolvedValue({ location: 'granted' })

    await getCurrentPosition()
    expect(requestPermissions).toHaveBeenCalled()
    expect(getCurrentPositionNative).toHaveBeenCalled()
  })

  it('throws a readable error when native permission is denied', async () => {
    isNativePlatform.mockReturnValue(true)
    checkPermissions.mockResolvedValue({ location: 'denied' })
    requestPermissions.mockResolvedValue({ location: 'denied' })

    await expect(getCurrentPosition()).rejects.toThrow('permission denied')
    expect(getCurrentPositionNative).not.toHaveBeenCalled()
  })

  it('maps timeout errors to a friendly message', async () => {
    getCurrentPositionNative.mockRejectedValue({ code: 3, message: 'timeout' })
    await expect(getCurrentPosition()).rejects.toThrow('timed out')
  })

  it('maps permission errors to a friendly message', async () => {
    getCurrentPositionNative.mockRejectedValue({ code: 1, message: 'denied' })
    await expect(getCurrentPosition()).rejects.toThrow('permission denied')
  })
})
