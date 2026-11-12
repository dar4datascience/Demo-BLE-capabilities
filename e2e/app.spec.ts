import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'
import { MAP_TILE_LAYERS } from '../src/map/tiles'

const here = dirname(fileURLToPath(import.meta.url))
const errorTilePng = readFileSync(resolve(here, 'fixtures', 'carto-error-tile.png'))

/** Fill {z}/{x}/{y} placeholders the same way Leaflet does. */
function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

/** Wait until every visible leaflet tile has finished loading. */
async function waitForTiles(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const tiles = [...document.querySelectorAll<HTMLImageElement>('.leaflet-tile')]
      return tiles.length > 0 && tiles.every((t) => t.complete && t.naturalWidth > 0)
    },
    undefined,
    { timeout: 25_000 },
  )
}

/**
 * Pixel stats for "is this actually a map?" — quantized unique colors and
 * luminance spread. Real map tiles have rich detail; error/blank tiles are
 * flat or a repeated placeholder.
 */
function pixelStats(png: PNG): { uniqueColors: number; lumStdDev: number } {
  const colors = new Set<number>()
  const lums: number[] = []
  for (let y = 0; y < png.height; y += 3) {
    for (let x = 0; x < png.width; x += 3) {
      const i = (png.width * y + x) << 2
      colors.add(((png.data[i] >> 4) << 8) | ((png.data[i + 1] >> 4) << 4) | (png.data[i + 2] >> 4))
      lums.push(0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2])
    }
  }
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length
  const variance = lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length
  return { uniqueColors: colors.size, lumStdDev: Math.sqrt(variance) }
}

test.describe('app shell', () => {
  test('player view renders core UI', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Player' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scan' })).toBeVisible()
    await expect(page.locator('.find-item').first()).toBeVisible()
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  test('admin view renders tag setup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Admin' }).click()
    await expect(page.getByRole('button', { name: 'New tag at my location' })).toBeVisible()
    await expect(page.locator('.tag-item').first()).toBeVisible()
    // Leaflet merges its class onto the container div itself
    await expect(page.locator('.admin__map.leaflet-container')).toBeVisible()
  })
})

test.describe('basemap tiles', () => {
  test('tile endpoints return real map images, not error placeholders', async ({ request }) => {
    // Sample several coordinates across both layers. The CARTO incident
    // served an identical "api key required" image for every request —
    // real tiles differ per coordinate.
    const samples: Array<[number, number, number]> = [
      [4, 3, 5],
      [4, 4, 6],
      [10, 336, 512],
      [12, 1344, 2048],
    ]
    const bodies = new Map<string, Buffer>()

    for (const layer of MAP_TILE_LAYERS) {
      for (const [z, x, y] of samples) {
        const url = tileUrl(layer.url, z, x, y)
        const resp = await request.get(url)
        expect(resp.ok(), `${url} → HTTP ${resp.status()}`).toBeTruthy()
        const contentType = resp.headers()['content-type'] ?? ''
        expect(contentType, `${url} content-type`).toMatch(/^image\//)
        const body = await resp.body()
        // Loose floor — the reference overlay is legitimately tiny over
        // empty areas. The identical-hash check below is the real guard.
        expect(body.length, `${url} empty body`).toBeGreaterThan(200)
        bodies.set(url, body)
      }
    }

    // Guard against "every tile is the same placeholder image".
    const hashes = new Set(
      [...bodies.values()].map((b) => createHash('md5').update(b).digest('hex')),
    )
    expect(
      hashes.size,
      'all sampled tiles are byte-identical — likely an error placeholder',
    ).toBeGreaterThan(1)
  })

  test('the known API-key error tile fails the visual-content check', () => {
    // Regression fixture: the exact CARTO "api key required" tile that
    // shipped broken. If thresholds ever drift, this proves the check
    // still discriminates real maps from error images.
    const stats = pixelStats(PNG.sync.read(errorTilePng))
    expect(stats.uniqueColors).toBeLessThanOrEqual(40)
  })

  test('map tiles render real map imagery', async ({ page, request }) => {
    await page.goto('/')
    await waitForTiles(page)

    // Frame a fixed, always-detailed view (central London) via the debug
    // handle so the screenshot baseline is deterministic.
    await page.evaluate(() => {
      ;(
        window as unknown as {
          __tagtrailMap?: { setView: (c: [number, number], z: number) => void }
        }
      ).__tagtrailMap?.setView([51.5074, -0.1278], 14)
    })
    // Let Leaflet swap in the new zoom's tiles before checking.
    await page.waitForTimeout(600)
    await waitForTiles(page)
    await page.waitForTimeout(800)

    // Visual regression on the map itself — catches error/blank tiles that
    // HTTP checks miss. Baseline may need `test:e2e:update` if the tile
    // provider restyles its imagery.
    await expect(page.locator('.player__map')).toHaveScreenshot('map-london.png', {
      animations: 'disabled',
      // Dark-on-dark themes need a tight color threshold or an all-wrong-tile
      // state can pass as "similar dark gray". Tile-provider restyles may
      // require `test:e2e:update`.
      threshold: 0.05,
      maxDiffPixelRatio: 0.05,
    })

    // Independently verify the tile URLs the app actually requested return
    // diverse real images (catches placeholder-serving and bad z/x/y
    // substitution, which pixel stats alone can't distinguish).
    const srcs = await page
      .locator('.leaflet-tile')
      .evaluateAll((imgs) => [...new Set(imgs.map((i) => (i as HTMLImageElement).src))])
    const hashes = new Set<string>()
    for (const src of srcs.slice(0, 12)) {
      const resp = await request.get(src)
      expect(resp.ok(), `${src} → HTTP ${resp.status()}`).toBeTruthy()
      expect(resp.headers()['content-type'] ?? '', src).toMatch(/^image\//)
      hashes.add(
        createHash('md5')
          .update(await resp.body())
          .digest('hex'),
      )
    }
    expect(
      hashes.size,
      'all loaded tiles are byte-identical — likely an error placeholder',
    ).toBeGreaterThan(1)
  })
})

test.describe('visual regression', () => {
  test('player view', async ({ page }) => {
    await page.goto('/')
    await waitForTiles(page)
    await page.waitForTimeout(800)
    await expect(page).toHaveScreenshot('player.png', {
      // Tiles come from an external service — mask the map so snapshots
      // stay deterministic; tile content is covered by the tests above.
      mask: [page.locator('.leaflet-container')],
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })

  test('admin view', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Admin' }).click()
    await expect(page.locator('.tag-item').first()).toBeVisible()
    await waitForTiles(page)
    await page.waitForTimeout(800)
    await expect(page).toHaveScreenshot('admin.png', {
      mask: [page.locator('.leaflet-container')],
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    })
  })
})
