/**
 * Reports the real world-space bounds of every prop in the running scene.
 *
 *   node scripts/measure.mjs [url]
 *
 * Placement bugs (a prop underground, two props intersecting, something that
 * silently failed to load) are obvious in these numbers and easy to miss in a
 * screenshot.
 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5180'

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base, { waitUntil: 'networkidle', timeout: 60_000 })
await page
  .waitForFunction(
    () => document.querySelector('.intro')?.classList.contains('is-gone') ?? true,
    { timeout: 60_000 },
  )
  .catch(() => {})
await page.waitForTimeout(1500)

const report = await page.evaluate(() => {
  const { scene } = window.__three ?? {}
  if (!scene) return { error: 'no scene handle' }

  const THREE = window.__THREE__ ?? null
  const rows = []

  const NAMES = [
    'desk',
    'monitor',
    'chair',
    'lamp',
    'plant',
    'vinyl',
    'guitars',
    'car',
    'vhs',
  ]

  for (const name of NAMES) {
    const obj = scene.getObjectByName(name)
    if (!obj) {
      rows.push({ name, missing: true })
      continue
    }

    // Box3 via the constructor already on an existing geometry's boundingBox
    // is unavailable here, so accumulate world-space vertices manually.
    let min = [Infinity, Infinity, Infinity]
    let max = [-Infinity, -Infinity, -Infinity]
    let meshes = 0
    let tris = 0

    obj.updateWorldMatrix(true, true)
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry) return
      meshes++
      const g = o.geometry
      const pos = g.attributes.position
      if (!pos) return
      tris += (g.index ? g.index.count : pos.count) / 3
      // Sample rather than walk every vertex — enough for placement checks.
      const step = Math.max(1, Math.floor(pos.count / 400))
      for (let i = 0; i < pos.count; i += step) {
        const v = [pos.getX(i), pos.getY(i), pos.getZ(i)]
        const m = o.matrixWorld.elements
        const wx = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]
        const wy = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]
        const wz = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
        min = [Math.min(min[0], wx), Math.min(min[1], wy), Math.min(min[2], wz)]
        max = [Math.max(max[0], wx), Math.max(max[1], wy), Math.max(max[2], wz)]
      }
    })

    rows.push({
      name,
      meshes,
      tris: Math.round(tris),
      min: min.map((n) => +n.toFixed(3)),
      max: max.map((n) => +n.toFixed(3)),
    })
  }

  return { rows, info: window.__three.gl.info.render }
})

await browser.close()

if (report.error) {
  console.log('!!', report.error)
  process.exit(1)
}

const DESK_TOP = 0.74
console.log('name        meshes   tris     x range          y range          z range')
console.log('─'.repeat(84))
for (const r of report.rows) {
  if (r.missing) {
    console.log(`${r.name.padEnd(11)} — NOT IN SCENE`)
    continue
  }
  const rng = (i) => `${r.min[i].toFixed(2)}…${r.max[i].toFixed(2)}`.padEnd(16)
  const flags = []
  if (r.min[1] < -0.02) flags.push('BELOW FLOOR')
  if (r.max[1] < 0.02) flags.push('FLAT/EMPTY')
  if (r.name !== 'desk' && r.name !== 'chair' && r.min[1] > DESK_TOP + 0.4) flags.push('FLOATING')
  console.log(
    `${r.name.padEnd(11)} ${String(r.meshes).padEnd(7)} ${String(r.tris).padEnd(8)} ` +
      `${rng(0)} ${rng(1)} ${rng(2)} ${flags.join(' ')}`,
  )
}
console.log(`\ndraw calls: ${report.info?.calls}   triangles on screen: ${report.info?.triangles}`)
if (errors.length) console.log('\npage errors:\n  ' + errors.join('\n  '))
