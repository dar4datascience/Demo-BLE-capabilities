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
        <strong>{{ store.progress.found }}/{{ store.progress.total }}</strong> found
      </div>
      <button
        class="scan-btn"
        :class="{ 'scan-btn--on': store.scanning }"
        :disabled="!scanSupported"
        @click="toggleScan"
      >
        {{ store.scanning ? 'Stop scanning' : 'Start scanning' }}
      </button>
    </header>

    <p v-if="!scanSupported" class="player__error">
      BLE scanning isn't supported in this browser — use the Android app or Chrome.
    </p>
    <p v-else-if="store.scanError" class="player__error">{{ store.scanError }}</p>

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
        <span class="find-item__icon">{{ row.found ? '✓' : '○' }}</span>
        <span class="find-item__name">{{ row.tag.name }}</span>
        <span class="find-item__dist" :class="`find-item__dist--${row.color}`">
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
  padding: 10px 14px;
  gap: 10px;
}

.player__progress {
  font-size: 15px;
}

.scan-btn {
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  cursor: pointer;
}

.scan-btn--on {
  background: #dc2626;
}

.scan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.player__error {
  margin: 0 14px 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 14px;
}

.find-list {
  list-style: none;
  margin: 0;
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 32vh;
  overflow-y: auto;
}

.find-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.08);
}

.find-item--found {
  background: rgba(34, 197, 94, 0.12);
}

.find-item--found .find-item__name {
  text-decoration: line-through;
  opacity: 0.7;
}

.find-item__icon {
  width: 20px;
  text-align: center;
  color: #64748b;
}

.find-item--found .find-item__icon {
  color: #16a34a;
}

.find-item__name {
  flex: 1;
  font-weight: 500;
}

.find-item__dist {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 44px;
  text-align: right;
  color: #64748b;
}

.find-item__dist--green {
  color: #16a34a;
}
.find-item__dist--yellow {
  color: #ca8a04;
}
.find-item__dist--red {
  color: #dc2626;
}

.find-item--empty {
  justify-content: center;
  color: #64748b;
}

.player__map {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
}
</style>
