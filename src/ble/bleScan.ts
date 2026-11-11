import { Capacitor } from '@capacitor/core'
import { BleClient, ScanMode } from '@capacitor-community/bluetooth-le'
import type { ScanResult } from '@capacitor-community/bluetooth-le'
import type { BleDetection, ScanCallback } from './types'

/**
 * Platform-agnostic BLE scan service.
 *
 * - Android (Capacitor native): full scanning via BluetoothLeScanner through
 *   `@capacitor-community/bluetooth-le`.
 * - Web: falls back to the Web Bluetooth API (`navigator.bluetooth.requestLEScan`)
 *   which is experimental and Chrome-only — expect degraded support.
 *
 * Components must go through this module; never import the plugin directly.
 */

export class BleUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BleUnavailableError'
  }
}

let scanning = false
let initialized = false

/** True when running inside the Capacitor Android shell. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** True when the Web Bluetooth scanning API exists (Chrome/Edge, secure context). */
export function isWebScanSupported(): boolean {
  return (
    !isNative() &&
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof (navigator.bluetooth as { requestLEScan?: unknown }).requestLEScan === 'function'
  )
}

/** Whether BLE scanning can be attempted on this platform at all. */
export function isScanSupported(): boolean {
  return isNative() || isWebScanSupported()
}

function normalize(result: ScanResult): BleDetection {
  return {
    deviceId: result.device.deviceId,
    name: result.localName ?? result.device.name,
    rssi: result.rssi ?? -127,
    manufacturerData: result.manufacturerData ?? {},
    serviceData: result.serviceData ?? {},
    rawAdvertisement: result.rawAdvertisement,
    timestamp: Date.now(),
  }
}

/**
 * Initialize BLE and request platform permissions. On Android this triggers the
 * BLUETOOTH_SCAN / BLUETOOTH_CONNECT runtime permission dialog
 * (`androidNeverForLocation` avoids also requiring location permission).
 */
export async function initializeBle(): Promise<void> {
  if (!isScanSupported()) {
    throw new BleUnavailableError(
      isNative()
        ? 'BLE is not supported on this device.'
        : 'Web Bluetooth scanning is unavailable — use Chrome/Edge over HTTPS or localhost.',
    )
  }
  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true })
    initialized = true
  }
}

/**
 * Start scanning for BLE advertisements. Resolves once the scan is running;
 * detections are delivered to `onDetection` until `stopScan()` is called.
 */
export async function startScan(onDetection: ScanCallback): Promise<void> {
  if (scanning) return
  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true })
    initialized = true
  }
  await BleClient.requestLEScan(
    {
      allowDuplicates: true,
      scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
    },
    (result) => {
      onDetection(normalize(result))
    },
  )
  scanning = true
}

/** Stop scanning. Safe to call when not scanning. */
export async function stopScan(): Promise<void> {
  if (!scanning) return
  scanning = false
  try {
    await BleClient.stopLEScan()
  } catch {
    // Scan may already have ended (e.g. web page hidden); ignore.
  }
}

export function isScanning(): boolean {
  return scanning
}
