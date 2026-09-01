import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useScene } from '../store'
import { LAMP_HEAD, LAMP_LIGHT, LAMP_TARGET } from '../data/scene'

/** Excluded from the counts below — it is scaffolding, not part of the room. */
const MARKER = 'xrayLampCone'

/** Apex at the shade, base at whatever the lamp is aimed at. */
const THROW = new THREE.Vector3(...LAMP_TARGET).distanceTo(new THREE.Vector3(...LAMP_HEAD))
/** The spotlight's angle is a half-angle, so this is the radius it reaches. */
const SPREAD = Math.tan(LAMP_LIGHT.angle) * THROW

/**
 * The "how it's made" mode: strips the room back to its construction.
 *
 * The counters this feeds to the HUD are the actual point — the room looks
 * hand-placed, and the numbers are what show it was budgeted.
 */
export function XRay() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const xray = useScene((s) => s.xray)
  const setStats = useScene((s) => s.setStats)

  /**
   * Basic rather than standard: unlit, so the wireframe reads identically in
   * daylight and at night. The subject here is the geometry, not the lighting,
   * and a lit wireframe all but vanishes once the lamp is the only source.
   */
  const wire = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#7fe3d4', wireframe: true }),
    [],
  )

  useEffect(() => () => wire.dispose(), [wire])

  /**
   * scene.overrideMaterial rather than traversing and flipping each material.
   *
   * useModel hands out clones that share their materials by reference, so a
   * traversal would have to dedupe before recording originals or it would
   * restore a value it had already overwritten. Worse, anything still
   * streaming in when the mode was toggled would be missed entirely. The
   * override is one assignment, catches meshes added later for free, and
   * unsets cleanly.
   */
  useEffect(() => {
    scene.overrideMaterial = xray ? wire : null
    return () => {
      scene.overrideMaterial = null
    }
  }, [scene, xray, wire])

  const cone = useRef<THREE.Group>(null)

  // Aimed the same way the spotlight is. Runs on every toggle because the group
  // only exists while the mode is on.
  useLayoutEffect(() => {
    cone.current?.lookAt(new THREE.Vector3(...LAMP_TARGET))
  }, [xray])

  const next = useRef(0)

  useFrame(({ clock }) => {
    if (!xray) return
    // Twice a second. These land in React state, and re-rendering the HUD every
    // frame to move a triangle count is not worth the frame it costs.
    const t = clock.getElapsedTime()
    if (t < next.current) return
    next.current = t + 0.5

    // Counted off the scene graph rather than read from gl.info.render.
    //
    // three resets those counters on every render() call, and the effect
    // composer runs several fullscreen passes per frame — so by the time this
    // samples them they describe the last bloom quad, which is why they read
    // "1 triangle, 1 draw call". Walking the graph also measures the right
    // thing for this panel: what the room is built from, not what the GPU
    // happened to do last.
    let triangles = 0
    let meshes = 0

    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      // The marker below is scaffolding, not part of the room.
      if (!mesh.isMesh || !mesh.geometry || mesh.name === MARKER) return
      meshes += 1
      const index = mesh.geometry.getIndex()
      const position = mesh.geometry.getAttribute('position')
      if (index) triangles += index.count / 3
      else if (position) triangles += position.count / 3
    })

    setStats({
      triangles: Math.round(triangles),
      meshes,
      // These two are genuine allocation counts, so they survive the composer.
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    })
  })

  if (!xray) return null

  return (
    /*
     * The lamp's spotlight, drawn as the cone it actually is — origin, aim,
     * angle and reach all read straight off the same constants the light is
     * built from, so this cannot drift from the thing it depicts.
     *
     * A marker at the emitter alone was the first attempt, and it sat inside
     * the lampshade where nothing could see it. The key light is not drawn at
     * all: it is at y 6.5, outside the framing of every shot in the file.
     */
    <group ref={cone} position={LAMP_HEAD}>
      {/* lookAt aims the group's +Z at the target. A cone points +Y with its
          apex up, so −90° about X swings that apex to −Z, and pushing the mesh
          a half-height along +Z lands the apex exactly on the group origin. */}
      <mesh name={MARKER} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, THROW / 2]}>
        {/* Open-ended and coarsely segmented: the sparse ruling lines are what
            separate it from the densely triangulated furniture, since the
            scene override means it cannot be separated by colour. */}
        <coneGeometry args={[SPREAD, THROW, 20, 1, true]} />
        <meshBasicMaterial wireframe side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
