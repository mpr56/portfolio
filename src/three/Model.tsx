import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

/** Every model in public/models, produced by scripts/optimize.mjs. */
export type ModelName =
  | 'monitor'
  | 'vinyl'
  | 'chair'
  | 'car'
  | 'car2'
  | 'car3'
  | 'camcorder'
  | 'vhscam'
  | 'sonycam'
  | 'guitar'
  | 'bass'
  | 'plant'
  | 'lamp'
  | 'phone'

const url = (name: ModelName) => `/models/${name}.glb`

// Local decoder rather than drei's default Google CDN: keeps the site working
// offline and removes a third-party request from the critical path.
const DRACO = '/draco/'

const _m = new THREE.Matrix4()

/**
 * Loads an optimised model and returns a private clone.
 *
 * The clone matters: useGLTF caches one scene graph per URL, so mutating it
 * (shadow flags, per-instance animation) would leak across every user of that
 * model. Cloning keeps geometry and textures shared but transforms separate.
 */
export function useModel(name: ModelName) {
  const { scene } = useGLTF(url(name), DRACO)

  return useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return root
  }, [scene])
}

/** Strip case and separators so `Vinyl.002`, `Vinyl_002` and `vinyl 002` all match. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Finds a named object inside a model — how the vinyl player gets its tonearm,
 * record and lid as separately animatable handles.
 *
 * Matching is separator-insensitive on purpose: glTF exporters rewrite `.` and
 * spaces to `_` inconsistently, so a literal match silently returns null and
 * the part just never animates.
 */
export function findPart(root: THREE.Object3D, match: string) {
  const want = slug(match)
  let hit: THREE.Object3D | null = null
  root.traverse((o) => {
    if (!hit && o.name && slug(o.name).includes(want)) hit = o
  })
  return hit as THREE.Object3D | null
}

/**
 * Reparents `object` under a new group positioned at `anchor` of its bounding
 * box, and returns that group.
 *
 * Exported model parts rarely have their origin where rotation needs it — a
 * record's origin is usually the file origin, not the spindle. Rotating the
 * part directly makes it orbit; rotating this pivot spins it in place.
 * `anchor` is normalised (0..1) per axis: [0.5, 0.5, 0.5] is the centre.
 */
const PIVOT_SUFFIX = '__pivot'

export function pivotAround(object: THREE.Object3D, anchor: [number, number, number]) {
  const parent = object.parent
  if (!parent) return null

  // StrictMode runs layout effects twice; without this the second pass nests a
  // second pivot inside the first and the rotations compound.
  if (parent.name.endsWith(PIVOT_SUFFIX)) return parent as THREE.Group

  const box = new THREE.Box3().setFromObject(object)
  const point = new THREE.Vector3(
    THREE.MathUtils.lerp(box.min.x, box.max.x, anchor[0]),
    THREE.MathUtils.lerp(box.min.y, box.max.y, anchor[1]),
    THREE.MathUtils.lerp(box.min.z, box.max.z, anchor[2]),
  )
  parent.worldToLocal(point)

  const pivot = new THREE.Group()
  pivot.name = `${object.name}${PIVOT_SUFFIX}`
  pivot.position.copy(point)
  parent.add(pivot)
  // attach() preserves the world transform, so nothing visibly moves.
  pivot.attach(object)
  return pivot
}

type ModelProps = {
  name: ModelName
  /** Applied to the loaded scene. Models arrive at real scale, origin at floor-centre. */
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  /**
   * Re-seat the model so its lowest point sits exactly on the group origin.
   *
   * The pipeline already does this, but it can't for every file: a model that
   * shipped rigged carries its vertices in bind space, and once the skeleton is
   * gone that offset is baked into the geometry where the offline bounds check
   * can't see it. This measures the real thing after load and corrects it.
   */
  ground?: boolean
}

export function Model({ name, position, rotation, scale, ground = false }: ModelProps) {
  const object = useModel(name)
  const holder = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    object.updateMatrixWorld(true)
    if (!ground || !holder.current) return

    const g = holder.current
    g.position.set(0, 0, 0)
    g.updateWorldMatrix(true, true)

    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return

    // setFromObject returns world space, but g.position is expressed in its
    // parent's space — subtracting one from the other is meaningless once any
    // ancestor has a transform, so bring the box into that space first.
    const parent = g.parent
    if (parent) {
      parent.updateWorldMatrix(true, false)
      box.applyMatrix4(_m.copy(parent.matrixWorld).invert())
    }

    // Only Y: the pipeline already centres footprints, and re-centring X/Z
    // would shove models that are correctly placed off their mark.
    g.position.y = -box.min.y
  }, [object, ground, position, rotation, scale])

  return (
    <group ref={holder}>
      <primitive object={object} position={position} rotation={rotation} scale={scale} />
    </group>
  )
}

// Warm the cache during the loading screen rather than on first look.
export function preloadModels(names: ModelName[]) {
  for (const n of names) useGLTF.preload(url(n), DRACO)
}
