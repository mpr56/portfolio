import { Suspense, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

import { ThemeDriver } from './theme'
import { Rig } from './Rig'
import { Lighting } from './Lighting'
import { useScene } from '../store'
import { SHOTS } from '../data/scene'

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

function Effects() {
  const dark = useScene((s) => s.dark)
  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={dark ? 0.95 : 0.32}
        luminanceThreshold={dark ? 0.62 : 0.85}
        luminanceSmoothing={0.22}
      />
      <Vignette offset={0.28} darkness={dark ? 0.86 : 0.6} eskil={false} />
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
