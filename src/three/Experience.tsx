import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { BloomEffect, VignetteEffect } from 'postprocessing'

import { ThemeDriver, themeMix } from './theme'
import { Rig } from './Rig'
import { Lighting } from './Lighting'
import { useScene } from '../store'
import { PALETTE, SHOTS } from '../data/scene'

/** Linear blend, matching how every other themed value samples the mix. */
const mix = (day: number, night: number, t: number) => day + (night - day) * t

import { Room } from './props/Room'
import { Desk } from './props/Desk'
import { Monitor } from './props/Monitor'
import { Lamp } from './props/Lamp'
import { Chair } from './props/Chair'
import { Plant } from './props/Plant'
import { VinylPlayer } from './props/VinylPlayer'
import { Guitars } from './props/Guitars'
import { CarModel } from './props/CarModel'
import { VhsShelf } from './props/VhsShelf'
import { WallName } from './props/WallName'

/**
 * Bloom and vignette, driven off the shared day→night mix in useFrame rather
 * than from the `dark` boolean as React props.
 *
 * Two reasons. Re-rendering the effect stack on every toggle made the composer
 * rebuild its passes, which is wasted work at exactly the moment the scene is
 * busiest. And as props these two snapped between values while every other
 * themed material eased, so the grade jumped a frame ahead of the room — now
 * they dissolve with everything else.
 */
function Effects() {
  const bloom = useRef<BloomEffect>(null)
  const vignette = useRef<VignetteEffect>(null)

  useFrame(() => {
    const night = themeMix.value
    if (bloom.current) {
      bloom.current.intensity = mix(PALETTE.day.bloom, PALETTE.night.bloom, night)
      bloom.current.luminanceMaterial.threshold = mix(0.85, 0.62, night)
    }
    if (vignette.current) {
      vignette.current.darkness = mix(PALETTE.day.vignette, PALETTE.night.vignette, night)
    }
  })

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        ref={bloom}
        mipmapBlur
        intensity={PALETTE.day.bloom}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.22}
      />
      <Vignette ref={vignette} offset={0.28} darkness={PALETTE.day.vignette} eskil={false} />
    </EffectComposer>
  )
}

export function Experience() {
  const setHovered = useScene((s) => s.setHovered)
  // Drop the pixel ratio ceiling if the GPU can't hold frame rate.
  const [dpr, setDpr] = useState(1.5)

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: SHOTS['/'].position, fov: SHOTS['/'].fov, near: 0.1, far: 60 }}
      onCreated={({ scene, gl, camera }) => {
        scene.background = new THREE.Color('#5b79ab')
        scene.fog = new THREE.Fog('#5b79ab', 12, 34)
        gl.toneMappingExposure = 1.05
        // Dev handle for scripts/measure.mjs — lets placement be measured
        // against the real scene graph instead of eyeballed from a screenshot.
        if (import.meta.env.DEV) {
          Object.assign(window as unknown as Record<string, unknown>, {
            __three: { scene, gl, camera },
            __THREE: THREE,
          })
        }
      }}
      onPointerMissed={() => {
        setHovered(null)
        document.body.style.cursor = 'auto'
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
      />

      {/* First child: seeds the day/night mix everything else samples. */}
      <ThemeDriver />
      <Rig />
      <Lighting />

      <Suspense fallback={null}>
        <Room />
        <Desk />
        <Monitor />
        <Lamp />
        <Chair />
        <Plant />
        <VinylPlayer />
        <Guitars />
        <CarModel />
        <VhsShelf />
        <WallName />
        <Preload all />
      </Suspense>

      <Effects />
      <AdaptiveDpr pixelated />
    </Canvas>
  )
}
