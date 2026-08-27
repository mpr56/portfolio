import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT, type Vec3 } from '../../data/scene'
import { Interactive } from '../Interactive'
import { useAudio } from '../../hooks/useAudio'
import { type ModelName, useModel } from '../Model'

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
  const object = useModel(model)

  useLayoutEffect(() => {
    // The supplied F40 ships with a white car-paint texture and separate mesh
    // pieces whose texture bakes in a bright head/tail-light glow. Keep the
    // source GLB intact and tune the rendered clone only.
    if (model !== 'car' || object.userData.f40Tuned) return

    const redMaterials = new Map<THREE.Material, THREE.Material>()
    const paintRed = (material: THREE.Material) => {
      const cached = redMaterials.get(material)
      if (cached) return cached

      const red = material.clone() as THREE.MeshStandardMaterial
      red.color.set('#b20d1d')
      red.metalness = 0.62
      red.roughness = 0.28
      red.emissive.set('#000000')
      red.needsUpdate = true
      redMaterials.set(material, red)
      return red
    }

    object.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return
      const mesh = node as THREE.Mesh
      const name = mesh.name.toLowerCase()

      if (name.includes('lights_') && name.includes('glow')) {
        mesh.visible = false
        return
      }
      if (!name.includes('carpaint')) return

      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(paintRed)
        : paintRed(mesh.material)
    })
    object.userData.f40Tuned = true
  }, [model, object])

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
        <primitive object={object} />
      </group>
    </group>
  )
}

/** Three die-casts — an F40, M2, and RX-7 — sharing one hotspot. */
export function CarModel() {
  const { isPlaying, toggle, stop } = useAudio('car', '/audio/engine.mp3', { volume: 0.4 })

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setTimeout(stop, 4000)
    return () => window.clearTimeout(timer)
  }, [isPlaying, stop])

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
      <Die model="car3" position={LAYOUT.car3.position} rotation={-1.2} running={isPlaying} phase={3.4} />
    </Interactive>
  )
}
