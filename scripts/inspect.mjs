/**
 * Prints the facts needed to place a downloaded model in the scene:
 * real-world size, where its origin sits relative to its bounds, mesh names
 * worth animating, and what is actually costing bytes.
 *
 *   node scripts/inspect.mjs [...glb paths]
 */
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'

// Needed to read anything that has already been through optimize.mjs.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
})
const files = process.argv.slice(2)
const f3 = (n) => Number(n.toFixed(3))

for (const path of files) {
  let doc
  try {
    doc = await io.readBinary(new Uint8Array(readFileSync(path)))
  } catch (err) {
    console.log(`\n${basename(path)}\n  !! unreadable: ${err.message}`)
    continue
  }

  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const b = getBounds(scene)
  const size = b.max.map((v, i) => v - b.min[i])

  const meshes = root.listMeshes()
  const tris = meshes.reduce(
    (n, m) =>
      n +
      m.listPrimitives().reduce((p, prim) => {
        const idx = prim.getIndices()
        const pos = prim.getAttribute('POSITION')
        return p + (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3
      }, 0),
    0,
  )

  const textures = root.listTextures()
  const texBytes = textures.reduce((n, t) => n + (t.getImage()?.byteLength ?? 0), 0)

  const extras = root.getAsset().extras ?? {}
  console.log(`\n━━ ${basename(path)}  (${(statSync(path).size / 1e6).toFixed(1)} MB on disk)`)
  if (extras.title || extras.author) {
    console.log(`   title        : ${extras.title ?? '—'}`)
    console.log(`   author       : ${extras.author ?? '—'}`)
    console.log(`   license      : ${extras.license ?? '—'}`)
    if (extras.source) console.log(`   source       : ${extras.source}`)
  }
  console.log(`   size (x,y,z) : ${size.map(f3).join(' × ')}`)
  console.log(`   bbox min     : ${b.min.map(f3).join(', ')}`)
  console.log(`   bbox max     : ${b.max.map(f3).join(', ')}`)
  console.log(`   triangles    : ${Math.round(tris).toLocaleString()}`)
  console.log(`   textures     : ${textures.length}  (${(texBytes / 1e6).toFixed(1)} MB)`)

  const dims = textures
    .map((t) => {
      const s = t.getSize()
      return s ? `${s[0]}×${s[1]}` : '?'
    })
    .reduce((acc, d) => ((acc[d] = (acc[d] ?? 0) + 1), acc), {})
  console.log(`   tex sizes    : ${Object.entries(dims).map(([d, n]) => `${n}×${d}`).join(', ') || '—'}`)

  console.log(`   animations   : ${root.listAnimations().map((a) => a.getName() || '(unnamed)').join(', ') || '—'}`)
  console.log(`   nodes        : ${root.listNodes().length}`)
  const names = meshes.map((m) => m.getName()).filter(Boolean)
  console.log(`   meshes (${meshes.length}) : ${names.slice(0, 22).join(' | ')}${names.length > 22 ? ' …' : ''}`)
}
