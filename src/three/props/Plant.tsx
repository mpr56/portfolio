import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { Model } from '../Model'
import { useQuality } from '../../quality'

export function Plant() {
  const group = useRef<THREE.Group>(null)
  // 115k triangles, and alpha-mapped foliage that decimates badly — so it is
  // dropped from the shadow passes rather than from the scene.
  const heavy = useQuality((s) => s.dynamic.heavyShadowCasters)

  useFrame((state) => {
    // Barely-there sway, enough to stop the scene reading as a still render.
    if (group.current) group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.006
  })

  return (
    <Interactive id="plant" passive>
      <group ref={group} position={LAYOUT.plant.position}>
        <Model name="plant" rotation={[0, 0.8, 0]} castShadow={heavy} />
      </group>
    </Interactive>
  )
}
