import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Center, Text3D } from '@react-three/drei'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LAMP_LIGHT, LAYOUT } from '../../data/scene'
import { intro, themeMix } from '../theme'
import { useScene } from '../../store'
import { Interactive } from '../Interactive'

/**
 * Vendored from three's own examples (MIT) rather than pulled from a CDN, so
 * the page has no third-party request on its critical path and still works
 * offline. three stopped shipping these in the npm package at r16x.
 */
const FONT = '/fonts/helvetiker_bold.typeface.json'

const TEXT = 'Manav Preet'
const SIZE = 0.092
/** Extrusion depth of the visible faces — the "return" of a channel letter. */
const DEPTH = 0.026
/** How far the halo stands proud of each letter's edge, in metres. */
const RIM = 0.0035

/**
 * Extruding glyph outlines leaves a handful of zero-area triangles at the
 * contour seams, and their vertex normals come out as exactly (0,0,0).
 *
 * That is not cosmetic. `normalize()` on a zero vector is 0/0 — NaN — so any
 * pixel those triangles cover writes NaN into the HDR buffer. Bloom's mipmap
 * chain then averages that NaN into every level, and NaN spreads to the whole
 * screen: the frame composites pure black. The triangles are sub-pixel, so
 * whether they land on a pixel centre depends on the exact projection, which
 * the camera's pointer parallax changes constantly — which is why it showed up
 * as a random black flash while moving the mouse.
 *
 * Substituting any unit vector removes the NaN. The triangles have no area, so
 * nothing about the render changes.
 */
function sanitizeNormals(geometry: THREE.BufferGeometry) {
  const normal = geometry.getAttribute('normal')
  if (!normal) return
  let fixed = 0
  for (let i = 0; i < normal.count; i++) {
    if (normal.getX(i) === 0 && normal.getY(i) === 0 && normal.getZ(i) === 0) {
      normal.setXYZ(i, 0, 0, 1)
      fixed++
    }
  }
  if (fixed) normal.needsUpdate = true
}

/**
 * Grows a copy of the letters outward by `RIM` in every direction, to sit
 * behind them as the halo.
 *
 * Scaling the text as a whole does not work, and that was the original bug: a
 * scale is applied about the centre of the *string*, so letters near the middle
 * barely move while the ones at the ends are shoved sideways — the M got a fat
 * rim on one side and the P got none. Pushing every vertex along its own normal
 * expands each letter about itself instead, so the rim is even across the word.
 *
 * The weld first is what makes that work: extruded text has split, flat normals
 * at every edge, and displacing those tears the mesh apart at the corners.
 * Welding and re-averaging gives each silhouette vertex one outward direction.
 */
function outlineOf(source: THREE.BufferGeometry) {
  const geometry = mergeVertices(source.clone(), 1e-5)
  geometry.computeVertexNormals()
  sanitizeNormals(geometry)

  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * RIM,
      position.getY(i) + normal.getY(i) * RIM,
      position.getZ(i) + normal.getZ(i) * RIM,
    )
  }
  position.needsUpdate = true
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Halo-lit channel letters on the left wall above the monitor.
 *
 * Built the way the real sign is: the letter faces are dark, and the light
 * comes from *behind* them. Three parts do that job —
 *
 *  1. an outline copy tucked in behind the faces, so an even bright rim stands
 *     proud of every letter and the bloom pass blooms it,
 *  2. the faces themselves, standing 12mm off the wall and casting a shadow,
 *  3. a warm point light in the cavity between the two, which is what actually
 *     washes the wall — bloom alone glows the letters but never lights what
 *     they are mounted on, and that wall wash is the whole effect.
 *
 * Clicking the letters cuts the glow, like the switch on the real thing.
 */
export function WallName() {
  const halo = useRef<THREE.MeshStandardMaterial>(null)
  const faceMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const wash = useRef<THREE.PointLight>(null)
  const haloMesh = useRef<THREE.Mesh>(null)
  const faceMesh = useRef<THREE.Mesh>(null)
  const toggleSign = useScene((s) => s.toggleSign)

  /** Eased 0..1 switch state, so the sign fades rather than cuts. */
  const lit = useRef(1)

  useLayoutEffect(() => {
    if (faceMesh.current?.geometry) sanitizeNormals(faceMesh.current.geometry)

    const mesh = haloMesh.current
    if (mesh?.geometry) {
      const previous = mesh.geometry
      mesh.geometry = outlineOf(previous)
      previous.dispose()
    }
  }, [])

  useFrame((_, dt) => {
    // Restrained by day, full halo once the room goes dark. intro.lights ramps
    // it in with the rest of the scene rather than having it lit on arrival.
    const night = themeMix.value
    const up = intro.lights
    lit.current = THREE.MathUtils.damp(lit.current, useScene.getState().signOn ? 1 : 0, 7, dt)
    const on = lit.current * up

    // Weighted toward the day end: at night the halo was already carrying the
    // sign, and pushing it further just blows the faces out to white and loses
    // the channel-letter read. Daylight is where it needed the help.
    if (halo.current) halo.current.emissiveIntensity = (1.3 + night * 2.2) * on
    if (wash.current) wash.current.intensity = (0.28 + night * 0.75) * on
    // Just enough in the faces that they read as dark metal rather than as a
    // black cut-out sitting in front of a glow.
    if (faceMaterial.current) faceMaterial.current.emissiveIntensity = (0.06 + night * 0.06) * on
  })

  return (
    <Interactive id="name" onActivate={toggleSign} lift={0}>
      <group position={LAYOUT.name.position} rotation={LAYOUT.name.rotation}>
        {/* 1. The halo, grown outward per letter and set back into the gap. */}
        <Center position={[0, 0, -0.005]}>
          <Text3D
            ref={haloMesh}
            font={FONT}
            size={SIZE}
            height={0.004}
            curveSegments={5}
            letterSpacing={0.004}
          >
            {TEXT}
            <meshStandardMaterial
              ref={halo}
              color="#000000"
              emissive={LAMP_LIGHT.color}
              emissiveIntensity={1.15}
              toneMapped={false}
            />
          </Text3D>
        </Center>

        {/* 2. The faces. Dark, faintly metallic so the returns catch an edge. */}
        <Center>
          <Text3D
            ref={faceMesh}
            font={FONT}
            size={SIZE}
            height={DEPTH}
            curveSegments={5}
            bevelEnabled
            bevelSize={0.0012}
            bevelThickness={0.0012}
            bevelSegments={2}
            letterSpacing={0.004}
            castShadow
          >
            {TEXT}
            <meshStandardMaterial
              ref={faceMaterial}
              color="#191a1f"
              emissive={LAMP_LIGHT.color}
              emissiveIntensity={0.05}
              roughness={0.42}
              metalness={0.35}
            />
          </Text3D>
        </Center>

        {/* 3. The wall wash, in the gap between the letter backs and the wall. */}
        <pointLight
          ref={wash}
          position={[0, 0, -0.008]}
          color={LAMP_LIGHT.color}
          distance={1.3}
          decay={2}
          intensity={0.22}
        />
      </group>
    </Interactive>
  )
}
