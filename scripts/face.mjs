/**
 * Reports the front face of a prop's model in that prop's own local space.
 *
 *   node scripts/face.mjs monitor
 *
 * Exists because overlaying anything on a model's screen (the PROJECTS panel)
 * needs the screen's real rectangle, and the transforms between a glTF's mesh
 * and its placed group are not something to work out on paper.
 */
import { chromium } from 'playwright'

const name = process.argv[2] ?? 'monitor'
const base = process.argv[3] ?? 'http://localhost:5180'

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(base, { waitUntil: 'networkidle', timeout: 60_000 })
await page
  .waitForFunction(
    () => document.querySelector('.intro')?.classList.contains('is-gone') ?? true,
    { timeout: 60_000 },
  )
  .catch(() => {})
await page.waitForTimeout(1200)

const out = await page.evaluate((propName) => {
  const scene = window.__three.scene
  const group = scene.getObjectByName(propName)
  if (!group) return { error: `no group named ${propName}` }
  group.updateWorldMatrix(true, true)

  const inv = group.matrixWorld.clone().invert()
  const pts = []
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return
    // Skip our own overlay plane, or it measures itself.
    if (o.userData.overlay) return
    const pos = o.geometry.attributes.position
    const m = o.matrixWorld
    const step = Math.max(1, Math.floor(pos.count / 4000))
    for (let i = 0; i < pos.count; i += step) {
      const v = new window.__THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
      v.applyMatrix4(m).applyMatrix4(inv)
      pts.push([v.x, v.y, v.z])
    }
  })
  if (!pts.length) return { error: 'no vertices' }

  // Profile the front surface by height band. A single "max z" is misleading
  // whenever something like a stand foot protrudes further than the glass, and
  // the band-to-band drift is what reveals a panel's backward lean.
  const ys = pts.map((p) => p[1])
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const step = (y1 - y0) / 12
  const bands = []
  for (let y = y0; y < y1; y += step) {
    const inBand = pts.filter((p) => p[1] >= y && p[1] < y + step)
    if (inBand.length < 4) continue
    const zmax = Math.max(...inBand.map((p) => p[2]))
    const front = inBand.filter((p) => p[2] > zmax - 0.005)
    const fx = front.map((p) => p[0])
    bands.push({
      y: y + step / 2,
      zmax,
      n: front.length,
      x: [Math.min(...fx), Math.max(...fx)],
    })
  }
  return { bands, bounds: { y: [y0, y1] } }
}, name)

await browser.close()

if (out.error) {
  console.log('!!', out.error)
  process.exit(1)
}

const f = (n) => n.toFixed(4)
console.log(`${name}: front-surface profile in its own local space\n`)
console.log('    y        front z    verts   x span')
for (const b of out.bands) {
  const wide = b.x[1] - b.x[0] > 0.3 ? '  ← panel' : ''
  console.log(
    `  ${f(b.y).padStart(8)}  ${f(b.zmax).padStart(9)}  ${String(b.n).padStart(5)}   ` +
      `${f(b.x[0])}…${f(b.x[1])}${wide}`,
  )
}

// Fit a line through the panel bands to recover the lean.
const panel = out.bands.filter((b) => b.x[1] - b.x[0] > 0.3)
if (panel.length >= 2) {
  const a = panel[0]
  const b = panel[panel.length - 1]
  const tilt = Math.atan2(b.zmax - a.zmax, b.y - a.y)
  const cy = (a.y + b.y) / 2
  const cz = (a.zmax + b.zmax) / 2
  const cx = (a.x[0] + a.x[1]) / 2
  console.log(
    `\n  panel: cx ${f(cx)}  cy ${f(cy)}  cz ${f(cz)}` +
      `  width ${f(a.x[1] - a.x[0])}  height ${f(b.y - a.y)}` +
      `\n  tilt ${f(tilt)} rad (${f((tilt * 180) / Math.PI)}°) — use as rotation.x`,
  )
}
