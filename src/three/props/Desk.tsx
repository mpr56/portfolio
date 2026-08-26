import type * as THREE from 'three'
import { DESK, LAYOUT, spanCenter, spanSize, type Span } from '../../data/scene'
import { Interactive } from '../Interactive'
import { useWoodTexture } from '../../hooks/useWoodTexture'

type WingProps = {
  x: Span
  z: Span
  top: THREE.Texture
  edge: THREE.Texture
}

/** One slab of the L. Both wings share a thickness and top height. */
function Wing({ x, z, top, edge }: WingProps) {
  const { height, thickness } = DESK
  const w = spanSize(x)
  const d = spanSize(z)

  return (
    <group position={[spanCenter(x), 0, spanCenter(z)]}>
      <mesh position={[0, height - thickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, thickness, d]} />
        {/* Per-face materials: grain runs across the top, along the edges. */}
        {[edge, edge, top, top, edge, edge].map((map, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={map}
            color="#8a7460"
            roughness={0.52}
            metalness={0.06}
          />
        ))}
      </mesh>

      {/* A darker underside plate reads as the slab's shadowed core and stops
          the floating edge looking like a hollow box. */}
      <mesh position={[0, height - thickness - 0.004, 0]} receiveShadow>
        <boxGeometry args={[w - 0.012, 0.008, d - 0.012]} />
        <meshStandardMaterial color="#150e09" roughness={0.85} />
      </mesh>
    </group>
  )
}

/**
 * Floating L-shaped corner desk.
 *
 * Built rather than downloaded so its dimensions stay authoritative: every
 * tabletop prop is positioned against DESK's extents, so this geometry and the
 * layout constants can never drift apart.
 */
export function Desk() {
  const top = useWoodTexture([2, 1])
  const edge = useWoodTexture([3, 0.4])

  return (
    <Interactive id="desk" passive>
      <group position={LAYOUT.desk.position}>
        <Wing x={DESK.back.x} z={DESK.back.z} top={top} edge={edge} />
        <Wing x={DESK.ret.x} z={DESK.ret.z} top={top} edge={edge} />
      </group>
    </Interactive>
  )
}
