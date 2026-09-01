import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { intro, mixNumber } from '../theme'
import { Model } from '../Model'
import { useScreenTexture } from '../../hooks/useScreenTexture'

/**
 * The screen rectangle in the monitor frame's local space, measured with
 * `node scripts/face.mjs monitorFrame` rather than guessed.
 *
 * The glass is not vertical — it leans back about 10.6°, its front z running
 * 0.080 at the bottom of the panel to 0.033 at the top. A plane at a fixed z
 * therefore sinks into the bezel at one end and floats off it at the other.
 * `tilt` is negative so the plane's normal rises with that lean, and `z` sits a
 * hair proud of the glass to avoid z-fighting.
 */
const SCREEN = {
  width: 1.1609,
  height: 0.3562,
  y: 0.3155,
  z: 0.0792,
  tilt: -0.125,
}

/** Canvas aspect must match width/height above, or the type skews. */
export const SCREEN_ASPECT = SCREEN.width / SCREEN.height

/**
 * The ultrawide, and the way into Projects.
 *
 * The model's own screen is baked into a shared texture atlas, so rather than
 * fight it we lay our own emissive panel just in front of the glass. That panel
 * is a real light source in the scene — it brightens at night and blooms.
 */
export function Monitor() {
  const navigate = useNavigate()
  const screenMat = useRef<THREE.MeshStandardMaterial>(null)
  const map = useScreenTexture(SCREEN_ASPECT)

  useFrame(() => {
    // intro.screen flickers the panel on during the opening, then holds at 1.
    if (screenMat.current) {
      screenMat.current.emissiveIntensity = mixNumber('screenIntensity') * intro.screen
    }
  })

  return (
    <Interactive id="monitor" onActivate={() => navigate('/projects')}>
      {/* Named so `node scripts/face.mjs monitorFrame` measures the screen in
          the frame's own rotated space rather than in world axes. */}
      <group
        name="monitorFrame"
        position={LAYOUT.monitor.position}
        rotation={LAYOUT.monitor.rotation}
      >
        <Model name="monitor" scale={1.3}/>
        {/*
          Matched to the panel measured by `node scripts/face.mjs monitor`: the
          glass is not vertical, it leans back about 11°, so a plane at a fixed
          z sinks into the bezel at one end and floats off it at the other.
        */}
        <mesh
          position={[0, SCREEN.y + 0.005, SCREEN.z ]}
          rotation={[SCREEN.tilt, 0, 0]}
          userData={{ overlay: true }}
        >
          <planeGeometry args={[SCREEN.width, SCREEN.height - 0.01]} />
          <meshStandardMaterial
            ref={screenMat}
            map={map}
            emissive="#ffffff"
            emissiveMap={map}
            emissiveIntensity={0.35}
            roughness={0.3}
            metalness={0}
            toneMapped={false}
          />
        </mesh>
      </group>
    </Interactive>
  )
}
