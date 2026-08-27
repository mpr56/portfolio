import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { useAudio } from '../../hooks/useAudio'
import { Model, type ModelName } from '../Model'

/** Model lengths in metres, from `npm run inspect` on the optimised files. */
const GUITAR_LEN = 1.02
const BASS_LEN = 1.15

/**
 * A wall hanger: a short arm off the wall with two padded cradles the neck
 * rests in. Small, but without it the instruments read as floating.
 */
function Hanger() {
  return (
    <group>
      <mesh position={[0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.013, 0.013, 0.08, 12]} />
        <meshStandardMaterial color="#17181c" roughness={0.5} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.08, 0.022, s * 0.036]} rotation={[0.45 * s, 0, 0]} castShadow>
          <capsuleGeometry args={[0.012, 0.046, 4, 10]} />
          <meshStandardMaterial color="#1e1f24" roughness={0.75} />
        </mesh>
      ))}
    </group>
  )
}

type HungProps = {
  model: ModelName
  /** Distance along the wall (world Z). */
  z: number
  /** Height of the instrument's lowest point. */
  bottom: number
  scale?: number
  /** The bass ships upright; the guitars ship lying flat. */
  upright?: boolean
}

/**
 * One instrument hung face-out from the left wall.
 *
 * The guitar model ships lying flat, length along X with the **headstock at
 * −X**, face up (+Y). A single −90° turn about Z is all it needs: that maps −X
 * to +Y (headstock up) and +Y to +X (face off the wall). Adding a flip on top
 * of that is what puts them upside down.
 *
 * The bass already ships standing, so it only needs a quarter turn to face out.
 *
 * Origins differ too, which is why `bottom` exists rather than a raw y: the
 * flat guitars carry a centred origin, the upright bass a floor origin.
 */
function Hung({ model, z, bottom, scale = 1, upright = false }: HungProps) {
  const length = (upright ? BASS_LEN : GUITAR_LEN) * scale
  const top = bottom + length
  // Centred origin sits half a length up; floor origin sits at the bottom.
  const originY = upright ? bottom : bottom + length / 2

  return (
    <group position={[0, 0, z]}>
      {/* Cradle the neck just below the headstock, where a real hanger sits. */}
      <group position={[0.03, top - 0.09, 0]}>
        <Hanger />
      </group>

      <group position={[0.075, originY, 0]}>
        {upright ? (
          <group rotation={[0, Math.PI / 2, 0]}>
            <Model name={model} scale={scale} />
          </group>
        ) : (
          <group rotation={[0, 0, -Math.PI / 2]}>
            <Model name={model} scale={scale} />
          </group>
        )}
      </group>
    </group>
  )
}

/** The instrument wall — a StingRay bass alongside an Ibanez JEM. */
export function Guitars() {
  const { isPlaying, toggle } = useAudio('guitars', '/audio/guitarRiff.mp3', { volume: 0.55 })
  const group = useRef<THREE.Group>(null)
  const t = useRef(0)

  useFrame((_, dt) => {
    if (!group.current) return
    // Short damped sway, as if the strings were just knocked. Rotating about Z
    // swings them across the wall rather than off it.
    t.current = isPlaying ? t.current + dt : 0
    const decay = Math.exp(-t.current * 2.4)
    group.current.rotation.z = Math.sin(t.current * 13) * 0.012 * decay
  })

  return (
    <Interactive id="guitars" onActivate={toggle} lift={0}>
      <group ref={group} position={LAYOUT.guitars.position} rotation={LAYOUT.guitars.rotation}>
        {/* `z` runs along the wall; with the group's quarter turn that maps to
            world −X, so the bass sits to the right of the guitar. */}
        <Hung model="bass" z={-0.38} bottom={0.92} upright />
        <Hung model="guitar" z={0.3} bottom={0.99} />
      </group>
    </Interactive>
  )
}
