import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { useScene } from '../../store'
import { useModel } from '../Model'
import { themeMix } from '../theme'

/**
 * Anglepoise floor lamp — the scene's light switch.
 *
 * The illumination itself lives in <Lighting /> (one spotlight, emitted from
 * LAMP_HEAD); this is the fixture, plus the job of making its shade glow in
 * step with that light. The model ships with an emissive map on the shade
 * material, so rather than bolt on our own geometry we just drive the
 * intensity of whatever material already carries one.
 */
export function Lamp() {
  const toggleDark = useScene((s) => s.toggleDark)
  const root = useModel('lamp')

  // Collect the shade materials once instead of traversing every frame.
  const emissive = useMemo(() => {
    const found: THREE.MeshStandardMaterial[] = []
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial
        if (std && 'emissiveMap' in std && std.emissiveMap) {
          std.emissive = new THREE.Color('#ffcf94')
          std.toneMapped = false
          found.push(std)
        }
      }
    })
    return found
  }, [root])

  useFrame(() => {
    for (const m of emissive) m.emissiveIntensity = themeMix.value * 2.4
  })

  return (
    <Interactive id="lamp" onActivate={toggleDark} lift={0}>
      <group position={LAYOUT.lamp.position} rotation={LAYOUT.lamp.rotation}>
        <primitive object={root} />
      </group>
    </Interactive>
  )
}
