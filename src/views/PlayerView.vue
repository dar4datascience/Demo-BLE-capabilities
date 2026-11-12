<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { isScanSupported } from '../ble/bleScan'
import { useBeaconScanner } from '../game/useBeaconScanner'
import { useGameStore } from '../game/store'
import { proximityColor } from '../game/logic'
import { GameMapService } from '../map/mapService'

const store = useGameStore()
const scanner = useBeaconScanner()
const mapEl = ref<HTMLElement | null>(null)
let mapService: GameMapService | null = null

const scanSupported = isScanSupported()

const tagRows = computed(() =>
  store.tags.map((tag) => {
    const d = store.detectionFor(tag.id)
    return {
      tag,
      detection: d,
      found: store.isFound(tag.id),
      distanceM: d?.distanceM,
      color: proximityColor(d?.distanceM),
    }
  }),
)

onMounted(() => {
  if (mapEl.value) {
    mapService = new GameMapService(mapEl.value)
    scanner.bindMap(mapService)
    mapService.fitToPoints(store.tags.map((t) => [t.lat, t.lng] as [number, number]))
    scanner.refreshGhosts()
    requestAnimationFrame(() => mapService?.invalidateSize())
  }
})

onUnmounted(() => {
  mapService?.destroy()
  mapService = null
})

async function toggleScan(): Promise<void> {
  if (store.scanning) await scanner.stop()
  else await scanner.start()
}
</script>

<template>
  <div class="player">
    <header class="player__bar">
      <div class="player__progress">
        <div class="player__progress-num">
          <strong>{{ store.progress.found }}</strong>
          <span class="player__progress-total">/{{ store.progress.total }}</span>
        </div>
        <span class="player__progress-label">tags found</span>
        <div class="player__progressbar">
          <div
            class="player__progressbar-fill"
            :style="{
              width: `${store.progress.total ? (store.progress.found / store.progress.total) * 100 : 0}%`,
            }"
          />
        </div>
      </div>
      <button
        class="scan-btn"
        :class="{ 'scan-btn--on': store.scanning }"
        :disabled="!scanSupported"
        @click="toggleScan"
      >
        <span class="scan-btn__dot" aria-hidden="true" />
        {{ store.scanning ? 'Stop' : 'Scan' }}
      </button>
    </header>

    <p v-if="!scanSupported" class="player__error">
      BLE scanning isn't supported in this browser — use the Android app or Chrome.
    </p>
    <p v-else-if="store.scanError" class="player__error">{{ store.scanError }}</p>

    <h3 class="player__section">Targets</h3>
    <ul class="find-list">
      <li
        v-for="row in tagRows"
        :key="row.tag.id"
        class="find-item"
        :class="{
          'find-item--found': row.found,
          'find-item--seen': row.detection !== undefined,
        }"
      >
        <span
          class="find-item__icon"
          :class="[`find-item__icon--${row.found ? 'found' : row.color}`]"
          >{{ row.found ? '✓' : '○' }}</span
        >
        <span class="find-item__name">{{ row.tag.name }}</span>
        <span
          class="find-item__dist"
          :class="row.found ? 'find-item__dist--found' : `find-item__dist--${row.color}`"
        >
          <template v-if="row.found">found</template>
          <template v-else-if="row.distanceM !== undefined"
            >{{ Math.round(row.distanceM) }}m</template
          >
          <template v-else>—</template>
        </span>
      </li>
      <li v-if="tagRows.length === 0" class="find-item find-item--empty">
        No tags configured — switch to Admin to add some.
      </li>
    </ul>

    <div ref="mapEl" class="player__map" />
  </div>
</template>

<style scoped>
.player {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.player__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px 10px;
}

.player__progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.player__progress-num {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 13px;
  color: var(--text-dim);
}

.player__progress-num strong {
  font-size: 26px;
  font-weight: 800;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.player__progress-total {
  font-size: 15px;
  font-weight: 600;
}

.player__progress-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.player__progressbar {
  width: 140px;
  max-width: 40vw;
  height: 5px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.player__progressbar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.55);
  transition: width 0.4s ease;
}

.scan-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #032b1e;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  box-shadow:
    0 4px 18px rgba(16, 185, 129, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.2s ease;
}

.scan-btn:hover {
  transform: translateY(-1px);
}

.scan-btn:active {
  transform: translateY(0);
}

.scan-btn__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #032b1e;
}

.scan-btn--on {
  color: #fff;
  background: linear-gradient(135deg, #f87171, #dc2626);
  box-shadow:
    0 4px 18px rgba(248, 113, 113, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: scan-pulse 1.6s ease-in-out infinite;
}

.scan-btn--on .scan-btn__dot {
  background: #fff;
  animation: dot-blink 1.2s ease-in-out infinite;
}

@keyframes scan-pulse {
  0%,
  100% {
    box-shadow:
      0 4px 18px rgba(248, 113, 113, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow:
      0 4px 26px rgba(248, 113, 113, 0.65),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

@keyframes dot-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.scan-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  animation: none;
}

.player__error {
  margin: 0 14px 8px;
  padding: 9px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
  font-size: 13px;
}

.player__section {
  margin: 2px 14px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.find-list {
  list-style: none;
  margin: 0;
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 32vh;
  overflow-y: auto;
}

.find-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.find-item--seen {
  border-color: var(--accent-border);
  background: linear-gradient(90deg, var(--accent-dim), transparent 55%), var(--surface);
}

.find-item--found {
  background: linear-gradient(90deg, rgba(52, 211, 153, 0.16), transparent 60%), var(--surface);
  border-color: rgba(52, 211, 153, 0.3);
}

.find-item--found .find-item__name {
  text-decoration: line-through;
  opacity: 0.65;
}

.find-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 700;
}

.find-item__icon--green {
  border-color: rgba(52, 211, 153, 0.6);
  color: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.25);
}

.find-item__icon--yellow {
  border-color: rgba(251, 191, 36, 0.6);
  color: #fbbf24;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.22);
}

.find-item__icon--red {
  border-color: rgba(248, 113, 113, 0.6);
  color: #f87171;
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.22);
}

.find-item__icon--found {
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: #032b1e;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.45);
}

.find-item__name {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
}

.find-item__dist {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 12px;
  min-width: 44px;
  padding: 3px 9px;
  text-align: center;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-dim);
}

.find-item__dist--green {
  background: rgba(52, 211, 153, 0.14);
  color: #34d399;
}
.find-item__dist--yellow {
  background: rgba(251, 191, 36, 0.14);
  color: #fbbf24;
}
.find-item__dist--red {
  background: rgba(248, 113, 113, 0.14);
  color: #f87171;
}
.find-item__dist--found {
  background: rgba(52, 211, 153, 0.18);
  color: var(--accent-strong);
}

.find-item--empty {
  justify-content: center;
  color: var(--text-dim);
  border-style: dashed;
}

.player__map {
  flex: 1;
  min-height: 0;
  margin: 6px 10px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}
</style>
