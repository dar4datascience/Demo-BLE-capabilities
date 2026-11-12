# TagTrail

A BLE tag scavenger-hunt game. Place Feasycom FSC-BP108 Bluetooth beacons around a play area — players find them with live BLE scanning, distance estimates, and a radar-style map. Runs as a web app **and** as an installable Android APK from one codebase (Vue 3 + TypeScript + Capacitor).

## Quickstart

```bash
npm install
npm run dev          # web app → http://localhost:5173
```

### Build the Android APK

```bash
npm run cap:sync     # builds web assets + syncs into android/
cd android && ./gradlew assembleDebug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

Copy the APK to an Android phone and install (allow "install unknown apps" when prompted). See [AGENTS.md](AGENTS.md) for the full toolchain setup, architecture rules, and contribution conventions.

## Testing

```bash
npm test             # unit tests (Vitest)
npm run test:e2e     # browser e2e + visual regression (Playwright)
npm run test:e2e:update  # regenerate screenshot baselines
```

## How it works

- **Admin view**: drop tags on a map, name them, set find-radius — exports a provisioning sheet for programming each beacon via the Feasycom FeasyBeacon app.
- **Player view**: start scanning → ghosts appear only for detected tags (green/yellow/red by proximity, pulsing) → a tag is "found" when the estimated distance drops below its radius.

## Hardware

[Feasycom FSC-BP108](https://www.feasycom.net/) BLE 5.1 beacons, configured as iBeacon via the free FeasyBeacon app.
