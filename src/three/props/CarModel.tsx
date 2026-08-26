import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT, type Vec3 } from '../../data/scene'
import { Interactive } from '../Interactive'
import { useAudio } from '../../hooks/useAudio'
import { Model, type ModelName } from '../Model'

/**
 * One die-cast, with an idle shudder while the engine is running.
 *
 * Placement and vibration are separate groups on purpose: the shake writes
 * position.y every frame, which would otherwise wipe out the desk height and
 * drop the car to the floor.
 */
function Die({
  model,
  position,
  rotation,
  running,
  phase,
}: {
  model: ModelName
  position: Vec3
  rotation: number
  running: boolean
  /** Offsets the shake so the pair never buzz in lockstep. */
  phase: number
}) {
  const body = useRef<THREE.Group>(null)
  const t = useRef(0)

  useFrame((_, dt) => {
    t.current = running ? t.current + dt : 0
    const on = running ? 1 : 0
    if (body.current) {
      // Small enough to read as a running engine at this scale.
      body.current.position.y = Math.sin(t.current * 42 + phase) * 0.0015 * on
      body.current.rotation.z = Math.sin(t.current * 31 + phase) * 0.005 * on
    }
  })

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={body}>
        <Model name={model} />
      </group>
    </group>
  )
}

/** The pair of die-casts — an F40 and an M2, sharing one hotspot. */
export function CarModel() {
  const { isPlaying, toggle } = useAudio('car', '/audio/engine.mp3', { volume: 0.4 })

  return (
    <Interactive id="car" onActivate={toggle}>
      <Die model="car" position={LAYOUT.car.position} rotation={-0.62} running={isPlaying} phase={0} />
      <Die
        model="car2"
        position={LAYOUT.car2.position}
        rotation={-0.34}
        running={isPlaying}
        phase={1.7}
      />
    </Interactive>
  )
}
