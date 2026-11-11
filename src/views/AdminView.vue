<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
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

function nextMajor(): number {
  const uuids = new Set(store.tags.map((t) => t.uuid))
  const sameGame = store.tags.filter((t) => uuids.has(t.uuid))
  return sameGame.length ? Math.max(...sameGame.map((t) => t.major)) + 1 : 1
}

function startNewTag(lat: number, lng: number): void {
  Object.assign(form, blankForm(), { lat, lng })
  editingId.value = null
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
  showForm.value = true
}

function cancelForm(): void {
  editingId.value = null
  showForm.value = false
  Object.assign(form, blankForm())
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
    <p class="admin__hint">Click the map to place a tag.</p>

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
  padding: 10px 14px;
  flex-wrap: wrap;
}

.admin__title {
  margin: 0;
  font-size: 18px;
}

.admin__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.admin__hint {
  margin: 0 14px 8px;
  color: #64748b;
  font-size: 13px;
}

.admin__error {
  margin: 0 14px 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 14px;
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
  border-radius: 12px;
  overflow: hidden;
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
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(127, 127, 127, 0.08);
}

.tag-form h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.tag-form label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: #475569;
}

.tag-form input {
  padding: 7px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
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

.btn {
  padding: 7px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}

.btn--primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.btn--danger {
  color: #b91c1c;
}

.admin__section {
  margin: 8px 0 0;
  font-size: 14px;
}

.tag-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tag-item {
  display: flex;
  align-items: center;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.08);
}

.tag-item__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
}

.tag-item__meta {
  font-size: 12px;
  color: #64748b;
}

.tag-item__del {
  padding: 8px 12px;
  border: none;
  background: none;
  color: #dc2626;
  cursor: pointer;
}

.tag-item--empty {
  justify-content: center;
  color: #64748b;
  padding: 10px;
}
</style>
