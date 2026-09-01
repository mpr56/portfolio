import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { intro, mixNumber } from '../theme'
import { Model } from '../Model'
import { usePhoneTexture } from '../../hooks/usePhoneTexture'

/**
 * The active screen rectangle in the phone's own local space.
 *
 * The model arrives standing upright at real scale with its origin at the
 * base, so these start from the iPhone 12 Pro's published dimensions: a
 * 64.3 × 139.2mm active area centred on a 71.5 × 146.7mm body. Unlike the
 * monitor's, this glass is flat, so there is no tilt to correct for — only `z`
 * sitting a hair proud of the front face to avoid z-fighting.
 *
 * Verify against the real thing with `node scripts/face.mjs phoneFrame`.
 */
const SCREEN = {
  width: 0.0643,
  height: 0.1392,
  y: 0.0735,
  z: 0.0042,
}

/** Canvas aspect must match width/height above, or the lock screen skews. */
export const PHONE_ASPECT = SCREEN.width / SCREEN.height

/**
 * Bigger than life, so it reads as a prop rather than as a speck on the desk.
 *
 * On the frame group rather than on <Model>, for the same reason the monitor's
 * lives there: the screen plane below is the Model's *sibling*, so scaling the
 * model alone would leave the panel at its true 64mm and every constant above
 * would need re-multiplying by hand. Scaling the parent moves both together.
 */
const SCALE = 1.6

/**
 * Face-up on the desk, and the way out to everywhere else.
 *
 * The links it carries all leave the site, which is a different verb to every
 * other prop here — so the phone opens a page of its own rather than firing a
 * visitor straight out to a new tab from a click on the desk.
 */
export function Phone() {
  const navigate = useNavigate()
  const screenMat = useRef<THREE.MeshStandardMaterial>(null)
  const map = usePhoneTexture(PHONE_ASPECT)

  useFrame(() => {
    // Shares the monitor's screenIntensity, so both screens come up together
    // during the opening and both brighten at night.
    if (screenMat.current) {
      screenMat.current.emissiveIntensity = mixNumber('screenIntensity') * intro.screen
    }
  })

  return (
    <Interactive id="phone" onActivate={() => navigate('/contact')} lift={0.012}>
      {/* Named so `node scripts/face.mjs phoneFrame` measures the glass in the
          phone's own rotated space rather than in world axes. */}
      <group
        name="phoneFrame"
        position={LAYOUT.phone.position}
        rotation={LAYOUT.phone.rotation}
        scale={SCALE}
      >
        <Model name="phone" />
        <mesh position={[0, SCREEN.y, SCREEN.z]}>
          <planeGeometry args={[SCREEN.width, SCREEN.height]} />
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
