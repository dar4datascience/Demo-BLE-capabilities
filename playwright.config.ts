import { defineConfig } from '@playwright/test'

/**
 * E2E + visual regression tests. Runs against the Vite dev server
 * (auto-started if not already running). Unit tests live in Vitest —
 * this suite is for real-browser checks: rendering, map tiles, screenshots.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  workers: 1, // single worker — the app uses localStorage; parallel pages could race on the dev server
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 390, height: 844 }, // phone-ish viewport — the app's real target
  },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
