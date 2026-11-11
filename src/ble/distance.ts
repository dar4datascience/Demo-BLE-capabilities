/**
 * RSSI → distance estimation via the log-distance path-loss model:
 *
 *   d = 10 ^ ((measuredPower − rssi) / (10 · n))
 *
 * where `measuredPower` is the calibrated RSSI at 1 m (iBeacon "Measured
 * Power") and `n` the path-loss exponent (~2.5 outdoors, up to ~4 indoors).
 * Accuracy is inherently rough (±30–50%) — used for proximity bands and
 * found-detection, not precise positioning.
 */

/** Path-loss exponent. ~2.2–2.7 open outdoor, higher indoors. Tunable. */
export const PATH_LOSS_EXPONENT = 2.5

/** Fallback calibrated RSSI@1m when a tag doesn't provide one. */
export const DEFAULT_MEASURED_POWER_DBM = -59

export const MIN_DISTANCE_M = 0.5
export const MAX_DISTANCE_M = 100

export function rssiToDistanceM(
  rssiDbm: number,
  measuredPowerDbm: number = DEFAULT_MEASURED_POWER_DBM,
  exponent: number = PATH_LOSS_EXPONENT,
): number {
  if (!Number.isFinite(rssiDbm) || !Number.isFinite(measuredPowerDbm) || exponent <= 0) {
    return MAX_DISTANCE_M
  }
  const d = 10 ** ((measuredPowerDbm - rssiDbm) / (10 * exponent))
  return Math.min(MAX_DISTANCE_M, Math.max(MIN_DISTANCE_M, d))
}

interface Estimate {
  value: number
  updatedAt: number
}

/**
 * Per-key exponential moving average over raw distance samples, with stale
 * expiry. Keeps one smoothed estimate per tag so ghost colors and found-checks
 * don't flicker on single noisy advertisements.
 */
export class DistanceTracker {
  private estimates = new Map<string, Estimate>()

  constructor(
    private readonly alpha = 0.3,
    private readonly staleMs = 4000,
  ) {}

  /** Feed a raw distance sample; returns the new smoothed distance. */
  update(key: string, rawDistanceM: number, now: number = Date.now()): number {
    const prev = this.estimates.get(key)
    const value =
      prev === undefined ? rawDistanceM : this.alpha * rawDistanceM + (1 - this.alpha) * prev.value
    this.estimates.set(key, { value, updatedAt: now })
    return value
  }

  /** Current smoothed distance, or undefined when missing/stale. */
  get(key: string, now: number = Date.now()): number | undefined {
    const e = this.estimates.get(key)
    if (!e || now - e.updatedAt > this.staleMs) return undefined
    return e.value
  }

  /** Drop entries not updated within `staleMs`. */
  prune(now: number = Date.now()): void {
    for (const [key, e] of this.estimates) {
      if (now - e.updatedAt > this.staleMs) this.estimates.delete(key)
    }
  }

  clear(): void {
    this.estimates.clear()
  }
}
