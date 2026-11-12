<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { getCurrentPosition } from '../geo/location'
import type { GpsFix } from '../geo/location'
import { downloadConfig, downloadProvisioningSheet, readConfigFile } from '../game/configIO'
import { beaconKey, useGameStore } from '../game/store'
import type { TagConfig } from '../game/types'
import { buildAdminTagSpecs } from '../map/adminMarkers'
import { GameMapService } from '../map/mapService'

const store = useGameStore()
const mapEl = ref<HTMLElement | null>(null)
let mapService: GameMapService | null = null
const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)

interface TagForm {
  id: string
  name: string
  uuid: string
  major: number
  minor: number
  lat: number
  lng: number
  findRadiusM: number
  measuredPowerDbm: number | null
}

const blankForm = (): TagForm => ({
  id: '',
  name: '',
  uuid: store.tags[0]?.uuid ?? 'b9407f30-f5f8-466e-aff9-25556b57fe6d',
  major: nextMajor(),
  minor: 1,
  lat: 0,
  lng: 0,
  findRadiusM: 5,
  measuredPowerDbm: null,
})

const form = reactive<TagForm>(blankForm())
const editingId = ref<string | null>(null)
const showForm = ref(false)
const gpsLoading = ref(false)
const gpsError = ref<string | null>(null)
const gpsAccuracyM = ref<number | null>(null)

function nextMajor(): number {
  const uuids = new Set(store.tags.map((t) => t.uuid))
  const sameGame = store.tags.filter((t) => uuids.has(t.uuid))
  return sameGame.length ? Math.max(...sameGame.map((t) => t.major)) + 1 : 1
}

function startNewTag(lat: number, lng: number): void {
  Object.assign(form, blankForm(), { lat, lng })
  editingId.value = null
  gpsAccuracyM.value = null
  showForm.value = true
}

function editTag(tag: TagConfig): void {
  Object.assign(form, {
    id: tag.id,
    name: tag.name,
    uuid: tag.uuid,
    major: tag.major,
    minor: tag.minor,
    lat: tag.lat,
    lng: tag.lng,
    findRadiusM: tag.findRadiusM,
    measuredPowerDbm: tag.measuredPowerDbm ?? null,
  })
  editingId.value = tag.id
  gpsAccuracyM.value = null
  showForm.value = true
}

function cancelForm(): void {
  editingId.value = null
  showForm.value = false
  gpsAccuracyM.value = null
  Object.assign(form, blankForm())
}

async function fetchGps(): Promise<GpsFix | null> {
  gpsLoading.value = true
  gpsError.value = null
  try {
    const fix = await getCurrentPosition()
    gpsAccuracyM.value = fix.accuracyM
    mapService?.flyTo(fix.lat, fix.lng)
    return fix
  } catch (err) {
    gpsAccuracyM.value = null
    gpsError.value = err instanceof Error ? err.message : 'Could not get your location.'
    return null
  } finally {
    gpsLoading.value = false
  }
}

async function newTagAtMyLocation(): Promise<void> {
  const fix = await fetchGps()
  if (!fix) return
  startNewTag(fix.lat, fix.lng)
  gpsAccuracyM.value = fix.accuracyM
}

async function useMyLocation(): Promise<void> {
  const fix = await fetchGps()
  if (!fix) return
  form.lat = fix.lat
  form.lng = fix.lng
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function saveTag(): void {
  const id = editingId.value ?? `tag-${slugify(form.name) || 'new'}-${Date.now().toString(36)}`
  const tag: TagConfig = {
    id,
    name: form.name.trim() || 'Unnamed tag',
    uuid: form.uuid.trim(),
    major: Math.trunc(form.major),
    minor: Math.trunc(form.minor),
    lat: form.lat,
    lng: form.lng,
    findRadiusM: form.findRadiusM,
    ...(form.measuredPowerDbm !== null ? { measuredPowerDbm: form.measuredPowerDbm } : {}),
  }
  store.upsertTag(tag)
  cancelForm()
  refreshMarkers()
}

function removeTag(tagId: string): void {
  store.removeTag(tagId)
  if (editingId.value === tagId) cancelForm()
  refreshMarkers()
}

function refreshMarkers(): void {
  mapService?.syncMarkers(buildAdminTagSpecs(store.tags))
  mapService?.fitToPoints(store.tags.map((t) => [t.lat, t.lng] as [number, number]))
}

async function onImportFile(e: Event): Promise<void> {
  importError.value = null
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const tags = await readConfigFile(file)
    store.importTags(tags)
    refreshMarkers()
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'import failed'
  } finally {
    input.value = ''
  }
}

const unknownList = computed(() => [...store.unknownBeacons.values()])

onMounted(() => {
  if (mapEl.value) {
    mapService = new GameMapService(mapEl.value)
    mapService.onMapClick((lat, lng) => startNewTag(lat, lng))
    refreshMarkers()
    requestAnimationFrame(() => mapService?.invalidateSize())
  }
})

onUnmounted(() => {
  mapService?.destroy()
  mapService = null
})
</script>

<template>
  <div class="admin">
    <header class="admin__bar">
      <h2 class="admin__title">Tag setup</h2>
      <div class="admin__actions">
        <button class="btn btn--accent" :disabled="gpsLoading" @click="newTagAtMyLocation">
          {{ gpsLoading ? 'Locating…' : 'New tag at my location' }}
        </button>
        <button class="btn" @click="downloadProvisioningSheet(store.tags)">Provisioning CSV</button>
        <button class="btn" @click="downloadConfig(store.tags)">Export JSON</button>
        <button class="btn" @click="fileInput?.click()">Import JSON</button>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          @change="onImportFile"
        />
        <button class="btn btn--danger" @click="store.resetProgress()">Reset progress</button>
      </div>
    </header>

    <p v-if="importError" class="admin__error">{{ importError }}</p>
    <p v-if="gpsError" class="admin__error">{{ gpsError }}</p>
    <p class="admin__hint">Click the map to place a tag, or use your GPS position.</p>

    <div class="admin__body">
      <div ref="mapEl" class="admin__map" />

      <aside class="admin__side">
        <form v-if="showForm" class="tag-form" @submit.prevent="saveTag">
          <h3>{{ editingId ? 'Edit tag' : 'New tag' }}</h3>
          <label>Name <input v-model="form.name" required /></label>
          <label> UUID <input v-model="form.uuid" required /> </label>
          <div class="tag-form__row">
            <label
              >Major <input v-model.number="form.major" type="number" min="0" max="65535" required
            /></label>
            <label
              >Minor <input v-model.number="form.minor" type="number" min="0" max="65535" required
            /></label>
          </div>
          <div class="tag-form__row">
            <label>Lat <input v-model.number="form.lat" type="number" step="any" required /></label>
            <label>Lng <input v-model.number="form.lng" type="number" step="any" required /></label>
          </div>
          <button
            type="button"
            class="btn btn--accent tag-form__gps"
            :disabled="gpsLoading"
            @click="useMyLocation"
          >
            {{ gpsLoading ? 'Locating…' : 'Use my location' }}
          </button>
          <p v-if="gpsAccuracyM !== null" class="tag-form__acc">
            GPS accuracy ±{{ Math.round(gpsAccuracyM) }} m
          </p>
          <div class="tag-form__row">
            <label
              >Find radius (m)
              <input
                v-model.number="form.findRadiusM"
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                required
            /></label>
            <label>
              RSSI@1m (optional)
              <input v-model.number="form.measuredPowerDbm" type="number" min="-127" max="20" />
            </label>
          </div>
          <div class="tag-form__actions">
            <button type="submit" class="btn btn--primary">Save</button>
            <button type="button" class="btn" @click="cancelForm">Cancel</button>
          </div>
        </form>

        <h3 class="admin__section">Tags ({{ store.tags.length }})</h3>
        <ul class="tag-list">
          <li v-for="tag in store.tags" :key="tag.id" class="tag-item">
            <button class="tag-item__main" @click="editTag(tag)">
              <strong>{{ tag.name }}</strong>
              <span class="tag-item__meta"
                >major {{ tag.major }} · minor {{ tag.minor }} · r={{ tag.findRadiusM }}m</span
              >
            </button>
            <button class="tag-item__del" @click="removeTag(tag.id)">✕</button>
          </li>
          <li v-if="store.tags.length === 0" class="tag-item tag-item--empty">
            No tags yet — click the map to add one.
          </li>
        </ul>

        <template v-if="unknownList.length">
          <h3 class="admin__section">Heard beacons (unmatched)</h3>
          <ul class="tag-list">
            <li
              v-for="u in unknownList"
              :key="beaconKey(u.uuid, u.major, u.minor)"
              class="tag-item"
            >
              <span class="tag-item__main">
                <strong>major {{ u.major }} minor {{ u.minor }}</strong>
                <span class="tag-item__meta">{{ u.sightings }} sightings · rssi {{ u.rssi }}</span>
              </span>
            </li>
          </ul>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.admin__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 14px 10px;
  flex-wrap: wrap;
}

.admin__title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.admin__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.admin__hint {
  margin: 0 14px 8px;
  color: var(--text-dim);
  font-size: 12.5px;
}

.admin__error {
  margin: 0 14px 8px;
  padding: 9px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
  font-size: 13px;
}

.admin__body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 10px;
  padding: 0 10px 10px;
}

.admin__map {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.admin__side {
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tag-form {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.tag-form h3 {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 700;
}

.tag-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.tag-form input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.28);
  color: var(--text);
  font-size: 14px;
  font-family: var(--font);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.tag-form input:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.tag-form input::-webkit-outer-spin-button,
.tag-form input::-webkit-inner-spin-button {
  opacity: 0.4;
}

.tag-form__row {
  display: flex;
  gap: 8px;
}

.tag-form__row label {
  flex: 1;
}

.tag-form__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.tag-form__gps {
  align-self: flex-start;
}

.tag-form__acc {
  margin: -2px 0 0;
  font-size: 12px;
  color: var(--text-dim);
}

.btn {
  padding: 8px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.12s ease;
}

.btn:hover {
  background: var(--surface-2);
  border-color: var(--border-strong);
}

.btn:active {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--accent {
  border-color: var(--accent-border);
  background: var(--accent-dim);
  color: var(--accent-strong);
}

.btn--accent:hover {
  background: rgba(16, 185, 129, 0.22);
  border-color: var(--accent-strong);
}

.btn--primary {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  border-color: transparent;
  color: #032b1e;
  box-shadow: 0 3px 12px rgba(16, 185, 129, 0.3);
}

.btn--primary:hover {
  background: linear-gradient(135deg, #6ee7b7, #10b981);
}

.btn--danger {
  color: var(--danger);
}

.btn--danger:hover {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.35);
}

.admin__section {
  margin: 6px 2px 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.tag-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-item {
  display: flex;
  align-items: center;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.tag-item:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.tag-item__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 9px 11px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: var(--text);
  font-family: var(--font);
}

.tag-item__meta {
  font-size: 11.5px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.tag-item__del {
  padding: 9px 13px;
  border: none;
  border-radius: 0 var(--radius) var(--radius) 0;
  background: none;
  color: var(--danger);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.tag-item__del:hover {
  background: rgba(248, 113, 113, 0.12);
}

.tag-item--empty {
  justify-content: center;
  color: var(--text-dim);
  padding: 12px;
  border-style: dashed;
}
</style>
