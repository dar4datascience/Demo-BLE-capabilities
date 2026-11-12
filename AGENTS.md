# TagTrail — Agent Guide

BLE tag scavenger-hunt game. An admin places Bluetooth Low Energy tags (Feasycom FSC-BP108) around a play area; players find them using live BLE scanning, distance estimation, and a radar-style map.

One codebase runs as a **web app** (browser, dev/demo) and as an **Android APK** (sideloaded, primary BLE target).

## Game rules (v1)

- **Ghosts**: a tag's marker appears on the player's map ONLY while its BLE signal is currently detected — positioned at its configured location, colored by proximity (green/yellow/red) with a pulsing ring. Undetected tags stay hidden.
- **Found**: a tag counts as found when its smoothed distance estimate ≤ its `findRadiusM`, sustained for a dwell period (~2s) to reject flicker.
- **Views**: same device toggles between `player` (find list + radar map) and `admin` (tag placement + config tools). No backend, no accounts.

## Tech stack

| Layer       | Choice                                                            | Version   |
| ----------- | ----------------------------------------------------------------- | --------- |
| Framework   | Vue 3 (`<script setup>`) + TypeScript strict                      | 3.5 / 5.9 |
| Build       | Vite (`base: './'` required for Capacitor)                        | 8         |
| Mobile      | Capacitor                                                         | 8         |
| BLE         | `@capacitor-community/bluetooth-le`                               | 8.x       |
| Maps        | Leaflet + OpenStreetMap tiles                                     | 1.9       |
| State       | Pinia                                                             | 4         |
| Tests       | Vitest                                                            | 5         |
| Lint/Format | ESLint 10 flat + typescript-eslint + eslint-plugin-vue + Prettier | —         |

## Repository layout

```
src/
  ble/         # BLE boundary: scan service, iBeacon parser, distance math (pure where possible)
  game/        # Pinia store, game types, pure game logic
  map/         # Leaflet service + ghost marker management
  views/       # PlayerView.vue, AdminView.vue
  components/  # shared UI components
  config/      # defaultGame.json seed data
tests colocated as src/**/*.spec.ts
android/       # Capacitor-generated native project (committed; build outputs gitignored)
```

## Commands

```bash
npm run dev          # web dev server (http://localhost:5173)
npm run typecheck    # vue-tsc project-references check
npm run lint         # eslint .
npm run lint:fix     # eslint --fix
npm run format       # prettier --write .
npm test             # vitest run (unit tests)
npm run test:e2e     # playwright e2e + visual regression (needs dev server or auto-starts one)
npm run test:e2e:update  # regenerate screenshot baselines after intentional UI changes
npm run build        # typecheck + vite build → dist/
npm run cap:sync     # build + copy web assets into android project
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### Android toolchain (already installed, user-local)

- JDK 21: `~/tools/jdk-21` · Android SDK: `~/Android/Sdk` (platform-36, build-tools-36.0.0)
- `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` exported in `~/.bashrc`
- `android/local.properties` holds `sdk.dir` (gitignored — per-machine)
- Sideload: copy `app-debug.apk` to phone → allow "install unknown apps" → install. Debug APK is debug-keystore signed; fine for local use.

## Architecture rules

1. **BLE only through `src/ble/`** — components/views never import `@capacitor-community/bluetooth-le` or call `navigator.bluetooth` directly.
2. **Pure logic stays pure** — iBeacon parsing (`ibean.ts`), distance math (`distance.ts`), found/color logic (`game/logic.ts`) are framework-free functions with Vitest coverage.
3. **State lives in the Pinia store** (`game/store.ts`) — views read/write the store; scan callbacks feed the store, never components directly.
4. **Map access only through `src/map/`** — Leaflet instances are owned by the map service, not views.
5. **TypeScript strict** — no `any` without justification; `verbatimModuleSyntax` is on (use `import type`).

## Conventions

- Vue 3 Composition API with `<script setup lang="ts">`; Pinia stores as `defineStore` setup-style.
- Prettier: no semicolons, single quotes, print width 100 — `npm run format` before committing.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), small and focused — one logical change per commit, reference the issue (`(#N)`).
- **No AI attribution** in commits, PRs, issues, or comments.
- Issue-driven workflow: each GitHub issue gets a short-lived `issue-<n>-<slug>` branch → merge to `main`.

## BLE & tag provisioning

Tags are Feasycom FSC-BP108 beacons broadcasting **iBeacon** frames, configured once with the official **FeasyBeacon** app (free; config PIN `000000`).

Per-tag iBeacon scheme:

- **UUID**: one shared UUID for all game tags (generate once, reuse)
- **Major**: unique per tag — this is the tag's ID in app config
- **Minor**: secondary ID / spare
- **Measured Power (RSSI@1m)**: calibrate per tag for better distance estimates
- TX power / adv interval: interval ~300–500ms for responsive scanning

The admin view's **provisioning sheet export** produces the Major→name list to type into FeasyBeacon per tag. See the Obsidian note `BLE Location Game/FSC-BP108 Beacon & Feasycom SDK` for hardware/SDK details.

## Platform notes

- **Android (APK)**: full BLE scan via the Capacitor plugin — this is the reliable target.
- **Browser**: BLE uses the Web Bluetooth API via the plugin's web layer — experimental/Chrome-only; expect degraded or unavailable scanning. Use the browser for UI/dev work, the APK for real scanning.
- Web Bluetooth requires a **secure context** (HTTPS or localhost) and a user gesture to start scanning.

## Testing

- Unit: `npm test` — cover all pure modules (parser, distance, game logic) plus store actions.
- E2E/visual: `npm run test:e2e` — Playwright + real Chromium against the Vite dev server (auto-started on :5199). Covers UI smoke, basemap tile sanity (HTTP checks + tile-hash diversity + a map-area screenshot baseline at a fixed view), and UI screenshot baselines with the map masked.
  - Tile URLs come from `src/map/tiles.ts` (`MAP_TILE_LAYERS`) — the single source of truth shared by app and tests.
  - Baselines live in `e2e/__screenshots__/` and are committed. External map tiles can drift — rerun `test:e2e:update` after intentional tile/UI changes.
  - `window.__tagtrailMap` exposes the Leaflet map for tests to frame deterministic views.
- Manual device checklist (see issue #17): build APK → install → provision a real tag → confirm ghost appears/colors/found.

## Definition of done

A feature is done when: typecheck/lint/test/build pass · new pure logic has unit tests · UI works in `npm run dev` · `cap sync` clean · changes committed conventionally on an issue branch and merged.
