import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { mixColor } from '../theme'
import { WALLS } from '../../data/scene'

/**
 * The ground plane, and the corner the desk is tucked into.
 *
 * The walls take the background tone rather than a lighter paint colour, so the
 * corner reads as depth instead of as a box the scene has been dropped inside —
 * and at night they give the lamp something to wash across.
 */
export function Room() {
  const floorMat = useRef<THREE.MeshStandardMaterial>(null)

  // One material instance shared by both walls, so they theme in lockstep.
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 }),
    [],
  )

  useFrame(() => {
    if (floorMat.current) mixColor(floorMat.current.color, 'floor')
    mixColor(wallMat.color, 'background')
  })

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial ref={floorMat} roughness={0.92} metalness={0} />
      </mesh>

      {WALLS.enabled && (
        <group>
          {/* Back wall */}
          <mesh
            position={[0, WALLS.height / 2, WALLS.back]}
            material={wallMat}
            receiveShadow
          >
            <planeGeometry args={[WALLS.extent * 2, WALLS.height]} />
          </mesh>

          {/* Left wall — the one the guitars hang on. */}
          <mesh
            position={[WALLS.left, WALLS.height / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            material={wallMat}
            receiveShadow
          >
            <planeGeometry args={[WALLS.extent * 2, WALLS.height]} />
          </mesh>
        </group>
      )}

      {/* Grounds the furniture far more cheaply than raising shadow-map res. */}
      <ContactShadows
        position={[0, 0.002, 0.1]}
        scale={9}
        resolution={1024}
        far={3.2}
        blur={2.6}
        opacity={0.55}
        frames={1}
      />
    </>
  )
}
