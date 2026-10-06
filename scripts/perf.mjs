/**
 * Measures what the model set costs at runtime, so asset work can be judged
 * instead of estimated.
 *
 *   node scripts/perf.mjs [url] [--route=/] [--label=before]
 *                         [--json=perf/before.json] [--seconds=8] [--dpr=2]
 *
 * Draw-call and triangle counters — what scripts/shot.mjs' sibling on the tier
 * branch reports — are the wrong instrument for texture work. Shrinking a map
 * from 1024² to 512² changes neither counter; it changes how many bytes the
 * sampler drags through the texture cache on every one of the two million
 * fragments a frame. So this measures three things those counters miss:
 *
 *   1. live texture memory, walked off the real scene graph, which is the
 *      claim the offline analysis makes and the one worth checking in-engine
 *   2. GPU time per frame, via EXT_disjoint_timer_query_webgl2 where the
 *      driver exposes it — the only direct read of the thing being optimised
 *   3. achieved frame rate with the renderer deliberately pushed past what the
 *      GPU can sustain, where a bandwidth saving turns into frames
 *
 * Numbers are indicative, not absolute. A headless Chromium on a busy laptop
 * is not a visitor's machine — what this is for is comparing two builds under
 * identical conditions.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (n) => flags.find((f) => f.startsWith(`--${n}=`))?.split('=').slice(1).join('=')

const base = positional[0] ?? 'http://localhost:5173'
const route = flag('route') ?? '/'
const label = flag('label') ?? 'default'
const json = flag('json')
const seconds = Number(flag('seconds') ?? 8)
/**
 * Forced onto the renderer directly, not via the browser's device scale
 * factor. Experience.tsx passes `dpr={1.5}` to the Canvas, and R3F applies
 * that over whatever the page reports — so launching Playwright at
 * deviceScaleFactor 3 changes the CSS pixel ratio and leaves the drawing
 * buffer exactly where it was. Measuring that way shows no difference between
 * 2 and 3 and looks like evidence of something; it is evidence of the flag
 * doing nothing.
 *
 * Above 1.5 this oversamples on purpose, to move the bottleneck onto the
 * fragment stage where texture bandwidth is actually spent.
 */
const dpr = Number(flag('dpr') ?? 1.5)

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
})

const logs = []
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await page.goto(new URL(route, base).toString(), { waitUntil: 'networkidle', timeout: 60_000 })

try {
  await page.waitForFunction(
    () => document.querySelector('.intro')?.classList.contains('is-gone') ?? true,
    { timeout: 60_000 },
  )
} catch {
  logs.push('[warn] never got past the loading curtain')
}

// Let the opening sequence finish and the damped values settle, so none of the
// intro's own work lands in the sample.
await page.waitForTimeout(4000)

if (!(await page.evaluate(() => Boolean(window.__three)))) {
  await browser.close()
  console.error('window.__three is missing — run this against `npm run dev`, not a preview build.')
  process.exit(1)
}

/**
 * Sums every distinct texture image reachable from the scene graph.
 *
 * Deduped by image, not by texture: three shares one image across several
 * Texture objects routinely, and counting per-texture double-counts them. The
 * ×4 is RGBA8, which is what a WebP decodes to once uploaded — the compressed
 * size on disk is not what occupies the GPU — and the ×4/3 is the mipmap
 * chain, which three generates for all of these.
 */
const textureMemory = () =>
  page.evaluate(() => {
    const { scene } = window.__three
    const seen = new Set()
    let bytes = 0
    let count = 0
    const MAPS = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap',
      'bumpMap',
      'displacementMap',
    ]
    scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
      for (const m of mats) {
        for (const slot of MAPS) {
          const t = m[slot]
          const img = t?.image
          if (!img || seen.has(img)) continue
          seen.add(img)
          const w = img.width ?? 0
          const h = img.height ?? 0
          if (!w || !h) continue
          bytes += w * h * 4 * (4 / 3)
          count++
        }
      }
    })
    return { megabytes: +(bytes / 1e6).toFixed(1), textures: count }
  })

/**
 * Frame cost over a window.
 *
 * `cpuMs` brackets render() on the CPU, which is submit time and nothing more
 * — the GPU is still working when it returns. `gpuMs` is the real number where
 * the extension exists; it comes back null where it does not, and a null is
 * reported as such rather than quietly substituted.
 */
async function sample(ms, movePointer = false) {
  await page.evaluate((movePointer) => {
    const { gl } = window.__three
    const ctx = gl.getContext()
    const ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2')
    const w = (window.__perf = {
      frames: 0,
      calls: 0,
      tris: 0,
      cpu: [],
      gpu: [],
      pending: [],
      deltas: [],
      last: 0,
      ext: Boolean(ext),
    })
    const render = gl.render.bind(gl)
    w.restore = () => {
      gl.render = render
      cancelAnimationFrame(w.raf)
    }
    gl.render = (scene, camera) => {
      let query = null
      // One query in flight at a time: nesting them is undefined, and the
      // composer calls render() several times per frame.
      if (ext && !w.inFlight) {
        query = ctx.createQuery()
        ctx.beginQuery(ext.TIME_ELAPSED_EXT, query)
        w.inFlight = true
      }
      const t0 = performance.now()
      render(scene, camera)
      w.cpu.push(performance.now() - t0)
      if (query) {
        ctx.endQuery(ext.TIME_ELAPSED_EXT)
        w.inFlight = false
        w.pending.push(query)
      }
      w.calls += gl.info.render.calls
      w.tris += gl.info.render.triangles
    }
    // Results land asynchronously; drain whatever is ready each tick.
    const drain = () => {
      w.pending = w.pending.filter((q) => {
        if (!ctx.getQueryParameter(q, ctx.QUERY_RESULT_AVAILABLE)) return true
        if (!ctx.getParameter(ext.GPU_DISJOINT_EXT)) {
          w.gpu.push(ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6)
        }
        ctx.deleteQuery(q)
        return false
      })
    }
    const canvas = gl.domElement
    const tick = (t) => {
      w.raf = requestAnimationFrame(tick)
      if (ext) drain()
      if (w.last) w.deltas.push(t - w.last)
      w.last = t
      w.frames++
      if (!movePointer) return
      const x = 700 + Math.sin(w.frames / 8) * 300
      const y = 500 + Math.cos(w.frames / 11) * 180
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }),
      )
    }
    w.raf = requestAnimationFrame(tick)
  }, movePointer)

  await page.waitForTimeout(ms)

  return page.evaluate((ms) => {
    const w = window.__perf
    w.restore()
    const med = (a) => {
      if (!a.length) return null
      const s = [...a].sort((x, y) => x - y)
      return +(s[s.length >> 1]).toFixed(3)
    }
    return {
      seconds: ms / 1000,
      fps: +(w.frames / (ms / 1000)).toFixed(1),
      medianFrameDelta: med(w.deltas),
      cpuRenderMs: med(w.cpu),
      gpuMs: w.ext ? med(w.gpu) : null,
      gpuSamples: w.gpu.length,
      drawCallsPerSecond: +(w.calls / (ms / 1000)).toFixed(0),
      trianglesPerSecond: +(w.tris / (ms / 1000)).toFixed(0),
    }
  }, ms)
}

// Applied after the intro has settled, so R3F's own setup does not overwrite
// it, and read back below rather than assumed.
await page.evaluate((dpr) => {
  const { gl } = window.__three
  gl.setPixelRatio(dpr)
  const { width, height } = gl.domElement.getBoundingClientRect()
  gl.setSize(width, height, false)
}, dpr)
await page.waitForTimeout(500)

const memory = await textureMemory()
const idle = await sample(seconds * 1000)
const active = await sample(seconds * 1000, true)

const report = {
  label,
  dpr,
  route,
  memory,
  // Read back, because a forced pixel ratio that silently failed to apply is
  // the exact failure this harness has already produced once.
  effectiveDpr: await page.evaluate(() => window.__three.gl.getPixelRatio()),
  drawingBuffer: await page.evaluate(() => {
    const c = window.__three.gl.domElement
    return `${c.width}x${c.height}`
  }),
  renderer: await page.evaluate(() => ({ ...window.__three.gl.info.memory })),
  idle,
  active,
}

await browser.close()

const row = (n, s) =>
  `  ${n.padEnd(7)} ${String(s.fps).padStart(6)} ${String(s.cpuRenderMs).padStart(9)} ${String(
    s.gpuMs ?? 'n/a',
  ).padStart(8)} ${String(s.drawCallsPerSecond).padStart(10)}`

console.log(
  `\n${label} — dpr ${report.effectiveDpr} (asked ${dpr}), buffer ${report.drawingBuffer}, route ${route}`,
)
console.log(`  textures ${memory.textures} live, ${memory.megabytes} MB (RGBA8 + mips)`)
console.log(`  renderer.info.memory: ${JSON.stringify(report.renderer)}`)
console.log('\n            fps  cpu ms/f  gpu ms/f  calls/sec')
console.log(row('idle', idle))
console.log(row('active', active))
if (!idle.gpuMs) console.log('\n  (no EXT_disjoint_timer_query_webgl2 — gpu ms unavailable)')

if (json) {
  mkdirSync(dirname(json), { recursive: true })
  writeFileSync(json, JSON.stringify(report, null, 2))
  console.log(`\nwrote ${json}`)
}

console.log(logs.length ? '\nconsole:\n  ' + [...new Set(logs)].slice(0, 15).join('\n  ') : '\nconsole: clean')
