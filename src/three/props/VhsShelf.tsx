import { useNavigate } from 'react-router-dom'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { Model } from '../Model'

const TAPE_H = 0.028
const SPINES = ['#7d2f2f', '#2f4a7d', '#2f7d5c']

/**
 * The videography corner: three camcorders around a short stack of tapes.
 *
 * Grouped as a single hotspot so the whole cluster responds together rather
 * than each body lighting up separately — it reads as one shelf, not four
 * objects that happen to be adjacent.
 */
export function VhsShelf() {
  const navigate = useNavigate()

  return (
    <Interactive id="vhs" onActivate={() => navigate('/videography')}>
      <group position={LAYOUT.vhs.position} rotation={[0, -0.28, 0]}>
        {/* Tapes are still built rather than downloaded — a VHS is a box, and
            three of them cost less than one more model request. */}
        {SPINES.map((c, i) => (
          <group
            key={i}
            position={[-0.24, TAPE_H / 2 + i * TAPE_H, 0.06]}
            rotation={[0, (i % 2 ? 1 : -1) * 0.05 * i, 0]}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.19, TAPE_H, 0.105]} />
              <meshStandardMaterial color="#1a1a1e" roughness={0.62} />
            </mesh>
            <mesh position={[0, 0, 0.0531]}>
              <planeGeometry args={[0.16, 0.014]} />
              <meshStandardMaterial color={c} roughness={0.8} />
            </mesh>
          </group>
        ))}

        {/* The VHS camcorder is the biggest, so it anchors the back. */}
        <group position={[-0.13, 0, -0.24]} rotation={[0, -0.62, 0]}>
          <Model name="vhscam" />
        </group>

        {/* Perched on the tape stack. `ground` because this one shipped rigged:
            its geometry keeps a bind-space offset that left it ~1.9m in the air
            regardless of where the group was placed. */}
        <group position={[-0.24, SPINES.length * TAPE_H, 0.06]} rotation={[0, -0.34, 0]}>
          <Model name="camcorder" ground />
        </group>

        <group position={[0.2, 0, -0.09]} rotation={[0, -0.95, 0]}>
          <Model name="sonycam" />
        </group>
      </group>
    </Interactive>
  )
}
