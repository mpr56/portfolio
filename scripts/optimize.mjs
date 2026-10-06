/**
 * Turns raw Sketchfab downloads into web-weight assets.
 *
 *   node scripts/optimize.mjs            # all entries in MODELS
 *   node scripts/optimize.mjs chair car  # just these
 *
 * Reads from internet3dmodels/, writes to public/models/. Source files are
 * never modified, so re-running after tweaking a budget is always safe.
 *
 * The wins, in order of how much they matter here:
 *   1. texture resize   — 4096² maps are ~90% of the bytes in this set
 *   2. WebP encode      — roughly another 3-4× on top of the resize
 *   3. simplify         — only where the model is needlessly dense
 *   4. Draco            — compresses what geometry remains
 */
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  prune,
  resample,
  simplify,
  textureCompress,
  draco,
  weld,
  flatten,
  join,
  metalRough,
  palette,
  clearNodeParent,
  clearNodeTransform,
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import { mkdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = 'internet3dmodels'
const OUT = 'public/models'

/**
 * Maps the shader reads as data rather than as an image. Surface normals and
 * roughness vary smoothly across a surface and are never resolved per-texel by
 * a viewer, so these run at half the colour budget — a quarter of the memory.
 */
const DATA_SLOTS = /normalTexture|metallicRoughnessTexture|occlusionTexture/

/**
 * Per-model budgets. `texture` is the max edge length in px for the colour
 * maps — data maps take half that, see DATA_SLOTS; `ratio` is the target
 * triangle count as a fraction of the original (1 = leave alone).
 *
 * Budgets are set by how large the object appears on screen, not by how
 * detailed the source is: the camcorder is a few hundred pixels tall in the
 * widest shot, so 1024 maps on it would be waste.
 *
 * The `on screen` figures in the comments below are the object's largest
 * dimension in native pixels, in whichever SHOT in data/scene.ts frames it
 * largest, at a 1000px-tall viewport and DPR 1.5. They are computed from the
 * camera positions rather than eyeballed, and they are the justification for
 * every number here: a texture wider than the object is ever drawn is memory
 * and sampling bandwidth spent on detail no display can resolve.
 *
 * Whoever changes a SHOT should re-derive these. Moving a camera closer to
 * something silently under-budgets it, and the failure is a soft, muddy
 * surface rather than anything that looks like a bug.
 */
const MODELS = {
  // `keep` isolates one object from a file that ships a whole product range.
  // `size` rescales to real-world metres on the named axis.
  // ~1040px on screen in its own /projects shot, where the camera is closest
  // to it. 2048 was double what that can resolve, and the panel itself is
  // covered by an emissive plane at runtime, so a third of the map was never
  // visible at any size.
  monitor: {
    file: 'basic_pc_monitors.glb',
    texture: 1024,
    ratio: 1,
    keep: ['Object_4'], // the ultrawide; Object_8 is the standard 24"
    size: { axis: 'x', value: 0.92 },
  },
  // The worst offender in the set before this change: 15 maps at 1024², 84 MB
  // of GPU memory, for an object that no shot ever approaches. It sits at the
  // far end of the long wing and peaks at ~256px on screen, in /about. 512
  // still leaves it double the resolution it can show.
  vinyl: {
    file: 'vinyl_player_pioneer.glb',
    texture: 512,
    ratio: 1,
    size: { axis: 'x', value: 0.44 }, // ships with the dust cover hinged open
  },
  // The arm reaches ~2m to −X, so the origin goes at the post rather than at
  // the middle of that span.
  lamp: {
    file: 'floor_lamp_3_low_poly.glb',
    texture: 1024,
    ratio: 1,
    size: { axis: 'y', value: 1.82 },
    origin: { x: 'max' },
  },
  chair: {
    file: 'realistic_office_chair_game_ready_low_poly_model.glb',
    texture: 1024,
    ratio: 1,
    keep: ['chair.001_low_CHAIR_0'], // 6 identical copies sit 1m apart in X
    size: { axis: 'y', value: 1.12 },
  },
  // Ratios below are set against on-screen size: a 21cm die-cast car does not
  // need 147k triangles, and the desk-top items are never more than a few
  // hundred pixels tall even in their close-up shot.
  car: {
    file: 'ferrari_f40.glb',
    texture: 512,
    ratio: 0.5,
    error: 0.01,
    size: { axis: 'z', value: 0.3 }, // full-size F40 → die-cast on the desk
  },
  car2: {
    file: '2001_bmw_m3_gtr.glb',
    texture: 512,
    ratio: 0.3,
    error: 0.02,
    // The M3 GTR is a shade shorter than an F40, so the pair stay in proportion.
    size: { axis: 'z', value: 0.285 },
  },
  car3: {
    file: '2018_mazda_rx-7_fd3s_fatal_stinger.glb',
    texture: 512,
    ratio: 0.45,
    error: 0.015,
    size: { axis: 'z', value: 0.275 },
  },
  // The videography cluster. Three real camcorders rather than the earlier
  // DSLR + generic camcorder pair.
  // All three peak between 410 and 590px, in /videography — the shot built
  // around them — and in the grazing edge of /contact. 512 is the honest
  // budget for the whole cluster; 1024 was a guess made before anything here
  // was measured.
  camcorder: {
    file: 'camcorder.glb',
    texture: 512,
    ratio: 1,
    size: { axis: 'z', value: 0.26 }, // source is ~100× real scale
  },
  // The largest of the three and the one /videography actually aims at, so it
  // is the one to watch if 512 turns out to be too tight anywhere.
  vhscam: {
    file: 'panasonic_m5_vhs_camcorder__game_ready_model.glb',
    texture: 512,
    ratio: 1,
    size: { axis: 'z', value: 0.34 },
  },
  sonycam: {
    file: 'sony_camcorder.glb',
    texture: 512,
    ratio: 0.25,
    error: 0.01,
    size: { axis: 'z', value: 0.24 },
  },
  guitar: { file: 'ibanez_jem_guitar.glb', texture: 1024, ratio: 0.6, size: { axis: 'x', value: 1.02 } },
  // Despite the filename, this one is a Music Man StingRay bass.
  bass: { file: 'muskonge_n24t6n23s4002.glb', texture: 1024, ratio: 0.2, size: { axis: 'y', value: 1.15 } },
  // Foliage is mostly alpha-mapped cards, so it decimates worse than hard
  // surfaces — keep a larger share of the triangles than the ratio elsewhere.
  plant: {
    file: 'ficus_lyrata_-_plants.glb',
    texture: 1024,
    ratio: 0.15,
    error: 0.008,
    size: { axis: 'y', value: 1.35 },
  },
  // 73k triangles for something 147mm long lying flat on a desk is absurd, so
  // this takes the hardest cut in the set. It survives it because a phone is
  // flat panels and rounded corners — the silhouette that matters is the
  // outline, and that is exactly what simplify preserves. Its own screen is
  // irrelevant too: Phone.tsx lays an emissive panel over the glass the way
  // the monitor does, so the baked one is never seen.
  phone: {
    file: 'iphone_12_pro.glb',
    texture: 512,
    ratio: 0.12,
    error: 0.01,
    size: { axis: 'y', value: 0.147 },
  },
}

/**
 * Turns rigged meshes back into static ones.
 *
 * A skinned mesh is positioned by its skeleton, not by its ancestors, so the
 * wrapper `normalize()` adds is simply ignored — the model renders at the world
 * origin at raw scale no matter where it is placed. None of these props are
 * animated, so the rig is pure liability: drop the skin and the mesh obeys the
 * scene graph like everything else.
 */
function unskin() {
  return (doc) => {
    const root = doc.getRoot()

    const skinned = root.listNodes().filter((n) => n.getSkin())
    if (!skinned.length) return

    for (const node of skinned) node.setSkin(null)
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        prim.setAttribute('JOINTS_0', null)
        prim.setAttribute('WEIGHTS_0', null)
      }
    }
    for (const skin of root.listSkins()) skin.dispose()

    // Dropping the skin is not enough on its own. A rigged mesh's vertices sit
    // in bind space, which can be a long way from the origin — the skeleton's
    // inverse bind matrices used to cancel that out. Left alone the mesh keeps
    // the offset and floats (this one sat ~1.9m above the desk). Baking the
    // hierarchy into the vertices puts the geometry where it looks like it is,
    // so the later bounds measurement is telling the truth.
    for (const node of root.listNodes()) {
      if (!node.getMesh()) continue
      clearNodeParent(node)
      clearNodeTransform(node)
    }
  }
}

/**
 * Drops everything but `keep`, then rescales and re-origins what remains so the
 * model arrives at real-world size with its origin at floor-centre. Doing this
 * in the asset means the scene code carries no per-model magic numbers.
 */
function normalize(cfg) {
  return (doc) => {
    const root = doc.getRoot()
    const scene = root.getDefaultScene() ?? root.listScenes()[0]

    if (cfg.keep) {
      for (const node of scene.listChildren()) {
        const name = node.getName() || node.getMesh()?.getName()
        if (!cfg.keep.includes(name)) node.dispose()
      }
    }

    const b = getBounds(scene)
    const span = b.max.map((v, i) => v - b.min[i])

    let s = 1
    if (cfg.size) {
      const axis = { x: 0, y: 1, z: 2 }[cfg.size.axis]
      if (span[axis] > 1e-9) s = cfg.size.value / span[axis]
    }

    // Which point in the footprint becomes the origin. Centre is right for
    // things that stand on their own footprint, but wrong for something like
    // the lamp, whose arm swings far to one side — there the origin belongs at
    // the post, or placing it means guessing where the base ended up.
    const pick = (which, i) =>
      which === 'min' ? b.min[i] : which === 'max' ? b.max[i] : (b.min[i] + b.max[i]) / 2
    const originX = pick(cfg.origin?.x ?? 'center', 0)
    const originZ = pick(cfg.origin?.z ?? 'center', 2)

    // Reparent under a single node carrying the correction, rather than
    // rewriting every vertex.
    const wrapper = doc.createNode('normalized')
    for (const child of scene.listChildren()) wrapper.addChild(child)
    scene.addChild(wrapper)

    wrapper.setScale([s, s, s])
    wrapper.setTranslation([-originX * s, -b.min[1] * s, -originZ * s])
  }
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })

await MeshoptSimplifier.ready

mkdirSync(OUT, { recursive: true })

const only = process.argv.slice(2)
const targets = Object.entries(MODELS).filter(([name]) => !only.length || only.includes(name))

const mb = (n) => (n / 1e6).toFixed(1)
let before = 0
let after = 0

for (const [name, cfg] of targets) {
  const src = resolve(cfg.source ?? SRC, cfg.file)
  if (!existsSync(src)) {
    console.log(`⚠  ${name.padEnd(10)} missing: ${cfg.file}`)
    continue
  }

  const srcSize = statSync(src).size
  const doc = await io.read(src)

  // Order matters: flatten/join before simplify so welding works across the
  // whole mesh, and compress textures before Draco so nothing is re-encoded.
  await doc.transform(
    // First: three.js dropped KHR_materials_pbrSpecularGlossiness, so anything
    // still using it renders untextured white until it's converted.
    metalRough(),
    // Before flatten: flatten refuses to collapse nodes a skin still binds to.
    unskin(),
    dedup(),
    flatten(),
    // Before join, because join can only merge primitives that already share a
    // material. The cars arrive as dozens of separate materials that differ
    // only by a solid colour — a paint, a plastic, a rubber — and each one is
    // its own draw call for the life of the page. palette bakes those colours
    // into a few pixels of shared texture so the materials become identical,
    // and join then collapses the primitives behind them. Materials that carry
    // real textures are left alone. No-ops below `min` unique colours.
    palette({ min: 3 }),
    join(),
    // After join: the mesh names used by `keep` are the post-join ones.
    normalize(cfg),
    weld(),
    // `error` is the cap on how far a vertex may move, as a fraction of the
    // mesh size. meshopt stops early when it would exceed this, so a tight
    // error silently overrides `ratio` — raise it when a model refuses to
    // come down to its target count.
    ...(cfg.ratio < 1
      ? [simplify({ simplifier: MeshoptSimplifier, ratio: cfg.ratio, error: cfg.error ?? 0.001 })]
      : []),
    resample(),
    prune({ keepAttributes: false, keepLeaves: false }),
    // Two passes, because `texture` is a budget for what the eye reads, not
    // for every map on the material. Normal, metallic-roughness and occlusion
    // are data the shader samples to modulate colour rather than images anyone
    // looks at, and halving them is the single cheapest win in this file: they
    // outnumber the colour maps roughly two to one, and each halving is 4× the
    // memory.
    //
    // The first pass deliberately carries no `slots` filter. Filtering it to
    // COLOUR_SLOTS looks tidier and is wrong: a texture matched by no filter
    // is not resized at all, so anything in an unexpected slot — the lamp has
    // one — sails through at full source resolution and the model comes out
    // larger than it went in. Capping everything first and then halving the
    // subset is safe because `resize` is a ceiling, never an upscale.
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [cfg.texture, cfg.texture],
      quality: 82,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      slots: DATA_SLOTS,
      resize: [cfg.texture / 2, cfg.texture / 2],
      quality: 82,
    }),
    draco({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  )

  const bytes = await io.writeBinary(doc)
  const dest = resolve(OUT, `${name}.glb`)
  writeFileSync(dest, bytes)

  before += srcSize
  after += bytes.byteLength
  const pct = (100 - (bytes.byteLength / srcSize) * 100).toFixed(0)
  console.log(`✓  ${name.padEnd(10)} ${mb(srcSize).padStart(6)} MB → ${mb(bytes.byteLength).padStart(6)} MB  (−${pct}%)`)
}

console.log(`\n   total      ${mb(before)} MB → ${mb(after)} MB`)
