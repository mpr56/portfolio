import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { intro, mixColor, mixNumber } from './theme'
import { LAMP_HEAD, LAMP_LIGHT, LAMP_TARGET } from '../data/scene'
import { isMoving, useQuality } from '../quality'

/**
 * How often the key light's shadow map is redrawn while the room is still.
 *
 * Plant.tsx sways 0.006 rad — a third of a degree — on a sine that never
 * stops, and that is the only thing moving in an idle scene. A soft shadow
 * drifting by that much is invisible at five redraws a second, and the map was
 * costing a full 300k-triangle depth pass on every one of the other 115.
 */
const KEY_SHADOW_HZ = 5

/**
 * All scene lighting, including the warm pool the lamp throws at night.
 * Everything here samples the shared day→night mix each frame rather than
 * switching on a boolean, so the toggle is a dissolve rather than a cut.
 */
export function Lighting() {
  const scene = useThree((s) => s.scene)
  const fixed = useQuality((s) => s.fixed)
  const ambient = useRef<THREE.HemisphereLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const lamp = useRef<THREE.SpotLight>(null)
  const lampTarget = useRef<THREE.Object3D>(null)
  const nextKeyShadow = useRef(0)

  useLayoutEffect(() => {
    // Draw both shadow maps once at startup, while it is still dark.
    //
    // The map has to exist before anything samples it: a shadow-casting light
    // whose map was never rendered leaves a plain colour texture bound to a
    // sampler2DShadow, which the driver rejects outright
    // (GL_INVALID_OPERATION) and the frame is lost. autoUpdate below then
    // stops either being redrawn every frame.
    if (lamp.current) lamp.current.shadow.needsUpdate = true
    if (key.current) {
      // The key light gets the treatment the lamp already had and
      // ContactShadows already had (frames={1}, Room.tsx:67). It was the one
      // light in the scene still paying for a full redraw every frame.
      key.current.shadow.autoUpdate = false
      key.current.shadow.needsUpdate = true
    }
  }, [])

  useFrame((state) => {
    // intro.lights ramps the room up on load. The lamp is deliberately left out
    // of it — that one is the visitor's switch, not part of the opening.
    const up = intro.lights

    if (ambient.current) {
      mixColor(ambient.current.color, 'ambient')
      ambient.current.intensity = mixNumber('ambientIntensity') * up
    }
    if (key.current) {
      mixColor(key.current.color, 'keyColor')
      key.current.intensity = mixNumber('keyIntensity') * up

      // Only geometry moving changes a shadow map — it is a depth pass, so the
      // ramp above and the day/night dissolve do not dirty it. three clears
      // needsUpdate itself once the map has been drawn.
      const now = state.clock.elapsedTime
      if (isMoving() || now >= nextKeyShadow.current) {
        key.current.shadow.needsUpdate = true
        nextKeyShadow.current = now + 1 / KEY_SHADOW_HZ
      }
    }
    if (lamp.current) {
      lamp.current.intensity = mixNumber('lampIntensity')
      // The lamp casts shadows from the very first frame, even while it is off.
      //
      // Turning castShadow on at click time changes how many shadow-casting
      // lights the scene has, and three recompiles *every* material when that
      // count changes — measured at 36 new shader programs, which is a stall of
      // seconds on a desktop and 20-30s on a phone. It was the entire reason the
      // first lamp click was so slow, and it only ever happened once per load.
      //
      // A light at intensity 0 contributes nothing, so leaving it on is free
      // visually. Only the shadow map's per-frame refresh is worth gating, and
      // that is what autoUpdate does — no recompile, because the light's
      // castShadow flag (which is what the shader variant keys on) never moves.
      lamp.current.shadow.autoUpdate = lamp.current.intensity > 0.5
      // Bind the aim point once it exists; three defaults target to the origin.
      if (lampTarget.current && lamp.current.target !== lampTarget.current) {
        lamp.current.target = lampTarget.current
      }
    }
    // Dim the backdrop alongside the lights, or the room goes dark against a
    // fully bright sky and the opening reads as a bug.
    if (scene.background instanceof THREE.Color) {
      mixColor(scene.background, 'background').multiplyScalar(0.38 + 0.62 * up)
    }
    if (scene.fog) mixColor(scene.fog.color, 'fog').multiplyScalar(0.38 + 0.62 * up)
  })

  return (
    <>
      <hemisphereLight ref={ambient} groundColor="#2a3038" intensity={1} />

      <directionalLight
        ref={key}
        // Keyed from the front-right: the corner walls face +X and +Z, so a
        // light from the left leaves both of them turned away from it.
        position={[3.9, 6.5, 3.4]}
        castShadow
        shadow-mapSize={[fixed.keyShadowMap, fixed.keyShadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.1, 20]} />
      </directionalLight>

      {/* Emitted from the shade itself, aimed back down at the desk. */}
      <object3D ref={lampTarget} position={LAMP_TARGET} />
      <spotLight
        ref={lamp}
        position={LAMP_HEAD}
        color={LAMP_LIGHT.color}
        angle={LAMP_LIGHT.angle}
        penumbra={LAMP_LIGHT.penumbra}
        distance={LAMP_LIGHT.distance}
        decay={LAMP_LIGHT.decay}
        intensity={0}
        castShadow
        shadow-mapSize={[fixed.lampShadowMap, fixed.lampShadowMap]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
    </>
  )
}
