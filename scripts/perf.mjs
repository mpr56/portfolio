/**
 * Measures what a frame actually costs, so the tier work can be judged instead
 * of estimated.
 *
 *   node scripts/perf.mjs [url] [--tier=high] [--route=/] [--label=before]
 *                         [--json=perf/before.json] [--seconds=10]
 *
 * Two samples per run: ten seconds sitting idle, then ten seconds with the
 * pointer moving, because the whole design turns on those being different.
 *
 * Follows scripts/shot.mjs: same browser flags, same wait for the loading
 * curtain, same use of the dev handles rather than faked clicks.
 *
 * Numbers are indicative, not absolute. A headless Chromium on a busy laptop
 * is not a visitor's machine — what this is for is comparing two builds under
 * identical conditions, which is exactly what the before/after table needs.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

const base = positional[0] ?? 'http://localhost:5180'
const tier = flag('tier')
const route = flag('route') ?? '/'
const label = flag('label') ?? tier ?? 'default'
const json = flag('json')
const seconds = Number(flag('seconds') ?? 10)

const url = new URL(route, base)
if (tier) url.searchParams.set('tier', tier)

const browser = await chromium.launch({
  args: [
    '--use-angle=metal',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ],
})

const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
})

const logs = []
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 })

// The curtain lifts by itself once every model has decoded.
try {
  await page.waitForFunction(
    () => document.querySelector('.intro')?.classList.contains('is-gone') ?? true,
    { timeout: 60_000 },
  )
} catch {
  logs.push('[warn] never got past the loading curtain')
}

// Let the opening sequence finish and the damped values settle, so none of the
// intro's own work lands in the idle sample.
await page.waitForTimeout(4000)

// __three is DEV-only (Experience.tsx:92), so this has to run against `npm run
// dev`, not a preview build. Say so plainly rather than failing on undefined.
const hasHandle = await page.evaluate(() => Boolean(window.__three))
if (!hasHandle) {
  await browser.close()
  console.error('window.__three is missing — run this against `npm run dev`, not a preview build.')
  process.exit(1)
}

/**
 * Counts frames and draw calls over a window.
 *
 * Draw calls come from a monkey-patched `render`, not from reading
 * `gl.info.render` at the end: the composer runs several fullscreen passes per
 * frame and three resets those counters on every render() call, so a reading
 * taken afterwards describes the last bloom quad. XRay.tsx:74-81 hit exactly
 * this and documents it.
 */
async function sample(ms, movePointer = false) {
  await page.evaluate((movePointer) => {
    const { gl } = window.__three
    const w = (window.__perf = { frames: 0, calls: 0, tris: 0, deltas: [], last: 0 })
    const render = gl.render.bind(gl)
    w.restore = () => {
      gl.render = render
      cancelAnimationFrame(w.raf)
    }
    gl.render = (scene, camera) => {
      render(scene, camera)
      w.calls += gl.info.render.calls
      w.tris += gl.info.render.triangles
    }
    const canvas = gl.domElement
    const tick = (t) => {
      w.raf = requestAnimationFrame(tick)
      if (w.last) w.deltas.push(t - w.last)
      w.last = t
      w.frames++
      if (!movePointer) return
      // Dispatched in-page rather than driven by page.mouse.move: Playwright
      // serialises operations on a page, so an outer mouse loop would contend
      // with the evaluate calls that start and stop this sample.
      const x = 700 + Math.sin(w.frames / 8) * 300
      const y = 500 + Math.cos(w.frames / 11) * 180
      const event = new PointerEvent('pointermove', {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerType: 'mouse',
      })
      canvas.dispatchEvent(event)
    }
    w.raf = requestAnimationFrame(tick)
  }, movePointer)

  await page.waitForTimeout(ms)

  return page.evaluate((ms) => {
    const w = window.__perf
    w.restore()
    // rAF ticks at the display rate whatever the scene does, so frames-per-
    // second here is the browser's rate, not the scene's. The scene's rate is
    // draw activity: count distinct render() bursts instead.
    const sorted = [...w.deltas].sort((a, b) => a - b)
    return {
      seconds: ms / 1000,
      rafFps: +(w.frames / (ms / 1000)).toFixed(1),
      medianRafDelta: +(sorted[sorted.length >> 1] ?? 0).toFixed(2),
      drawCalls: w.calls,
      triangles: w.tris,
      drawCallsPerSecond: +(w.calls / (ms / 1000)).toFixed(0),
      trianglesPerSecond: +(w.tris / (ms / 1000)).toFixed(0),
    }
  }, ms)
}

const idle = await sample(seconds * 1000)

// Synthetic pointer movement: the active path, and the one a visitor spends
// most of their time in.
const active = await sample(seconds * 1000, true)

const report = {
  label,
  url: url.toString(),
  tier: await page.evaluate(() => document.documentElement.dataset.tier ?? null),
  dpr: await page.evaluate(() => window.__three?.gl.getPixelRatio() ?? null),
  idle,
  active,
}

await browser.close()

const row = (name, s) =>
  `  ${name.padEnd(8)} ${String(s.drawCallsPerSecond).padStart(9)} ${String(
    s.trianglesPerSecond,
  ).padStart(13)} ${String(s.medianRafDelta).padStart(9)}`

console.log(`\n${report.label} — tier ${report.tier ?? '?'}, dpr ${report.dpr ?? '?'}`)
console.log('           calls/sec  triangles/sec  rAF ms')
console.log(row('idle', idle))
console.log(row('active', active))

if (json) {
  mkdirSync(dirname(json), { recursive: true })
  writeFileSync(json, JSON.stringify(report, null, 2))
  console.log(`\nwrote ${json}`)
}

if (logs.length) {
  console.log('\nconsole:')
  for (const l of [...new Set(logs)].slice(0, 25)) console.log('  ' + l)
} else {
  console.log('\nconsole: clean')
}
