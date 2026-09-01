/**
 * Screenshots the running scene, so placement and lighting can be judged
 * instead of guessed.
 *
 *   node scripts/shot.mjs [url] [outfile] [--dark] [--route=/projects] [--guide]
 *
 * Enters past the loading curtain, waits for the camera to settle, and reports
 * anything the page logged to the console on the way.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const positional = args.filter((a) => !a.startsWith('--'))

const base = positional[0] ?? 'http://localhost:5180'
const out = positional[1] ?? 'shots/scene.png'
const dark = flags.includes('--dark')
const route = flags.find((f) => f.startsWith('--route='))?.split('=')[1] ?? '/'

mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true })

const browser = await chromium.launch({
  args: [
    '--use-angle=metal',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ],
})

// --mobile renders at phone size with touch, which is the only way to see the
// pan scrubber — it is hidden on wide, pointer-precise screens.
const mobile = flags.includes('--mobile')
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  isMobile: mobile,
  hasTouch: mobile,
})

const logs = []
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[404?] ${r.url()} — ${r.failure()?.errorText}`))

await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60_000 })

// The curtain lifts by itself once every model has decoded.
try {
  await page.waitForFunction(
    () => document.querySelector('.intro')?.classList.contains('is-gone') ?? true,
    { timeout: 60_000 },
  )
} catch {
  logs.push('[warn] never got past the loading curtain')
}

if (dark) {
  // Flip night via the dev store handle rather than hunting for the lamp in 3D.
  await page.evaluate(() => window.__scene?.setState({ dark: true }))
  await page.waitForTimeout(1600)
}

if (flags.includes('--xray')) {
  await page.evaluate(() => window.__scene?.setState({ xray: true }))
  // Long enough for the readout to take its first sample.
  await page.waitForTimeout(900)
}

// Not --help, which every CLI already spells for something else.
if (flags.includes('--guide')) {
  await page.evaluate(() => window.__scene?.setState({ help: true }))
  // Each label waits on its prop's bounding box, measured on the next frame.
  await page.waitForTimeout(900)
}

// --focus=x,y,z[,dist] parks the camera on one prop, bypassing the route rig.
const focus = flags.find((f) => f.startsWith('--focus='))?.split('=')[1]
if (focus) {
  const [x, y, z, dist = 1.2] = focus.split(',').map(Number)
  await page.evaluate(
    ([x, y, z, d]) => {
      window.__freezeCamera = true
      const { camera } = window.__three
      camera.position.set(x + d * 0.7, y + d * 0.55, z + d)
      camera.lookAt(x, y, z)
      camera.fov = 40
      camera.updateProjectionMatrix()
    },
    [x, y, z, Number(dist)],
  )
}

// --at=<ms> captures partway through the opening sequence instead of waiting
// for it to finish, which is the only way to check the light-up.
const at = flags.find((f) => f.startsWith('--at='))?.split('=')[1]

// Let the rig ease into its framing and the damped values settle.
await page.waitForTimeout(at ? Number(at) : focus ? 900 : 2600)
await page.screenshot({ path: out })
await browser.close()

console.log(`saved ${out}`)
if (logs.length) {
  console.log('\nconsole:')
  for (const l of [...new Set(logs)].slice(0, 25)) console.log('  ' + l)
} else {
  console.log('console: clean')
}
