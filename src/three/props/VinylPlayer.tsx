import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { useAudio } from '../../hooks/useAudio'
import { useModel } from '../Model'

/** 33⅓ rpm in radians per second — the record turns at the real rate. */
const RPM_33 = (33.333 / 60) * Math.PI * 2

/**
 * Where the platter sits on the Pioneer, in the group's local space.
 *
 * Found by scanning the model for a horizontal band of vertices whose radii
 * all cluster near the maximum — i.e. a ring. That band sits at world y 0.805
 * centred on (0.632, −0.517) with radius 0.165, which is this once the group's
 * position and its 0.5 rad turn are taken back out.
 */
const PLATTER = { x: -0.055, y: 0.1, z: 0.02, radius: 0.152 }

/**
 * The record. Drawn here rather than spun from the model's own geometry.
 *
 * The optimised GLB went through `join()`, which merged the platter into a
 * mesh with its neighbours — its bounding-box centre is nowhere near the
 * spindle, so rotating it swung the whole assembly across the desk instead of
 * spinning it in place. Owning the disc means owning its centre.
 *
 * It sits a couple of millimetres proud of the model's own record, covering
 * it. Re-add vinyl_player_pioneer.glb to internet3dmodels/ and this can be
 * dropped: exported without `join()`, the real platter becomes spinnable and
 * keeps its sleeve artwork.
 */
function Record({ spinning }: { spinning: boolean }) {
  const disc = useRef<THREE.Group>(null)
  const speed = useRef(0)

  useFrame((_, dt) => {
    // Spin up and coast down rather than snapping — it should feel like a motor.
    speed.current = THREE.MathUtils.damp(speed.current, spinning ? RPM_33 : 0, 2.2, dt)
    if (disc.current) disc.current.rotation.y += speed.current * dt
  })

  return (
    <group ref={disc} position={[PLATTER.x, PLATTER.y, PLATTER.z]} userData={{ myRecord: true }}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[PLATTER.radius, PLATTER.radius, 0.004, 64]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.34} metalness={0.05} />
      </mesh>
      {/* Centre label, offset from the spindle so the spin is readable. */}
      <mesh position={[0, 0.0025, 0]}>
        <cylinderGeometry args={[0.049, 0.049, 0.001, 48]} />
        <meshStandardMaterial color="#d8563f" roughness={0.75} />
      </mesh>
      <mesh position={[0.026, 0.0035, 0]}>
        <boxGeometry args={[0.03, 0.0006, 0.006]} />
        <meshStandardMaterial color="#f3e6cf" roughness={0.8} />
      </mesh>
    </group>
  )
}

export function VinylPlayer() {
  const { isPlaying, toggle } = useAudio('vinyl', '/audio/vinlySong.mp3', { loop: true, volume: 0.5 })
  const root = useModel('vinyl')

  return (
    <Interactive id="vinyl" onActivate={toggle}>
      <group position={LAYOUT.vinyl.position} rotation={[0, 0, 0]}>
        <primitive object={root} />
        <Record spinning={isPlaying} />
      </group>
    </Interactive>
  )
}
