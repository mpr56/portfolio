import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Procedural dark-walnut grain for the desk slab.
 *
 * Generated rather than downloaded: it's a few KB instead of a few MB, tiles
 * seamlessly by construction, and the tone can be tuned to sit against the
 * scene's blues without round-tripping through an image editor.
 */
export function useWoodTexture(repeat: [number, number] = [1, 1]) {
  return useMemo(() => {
    const w = 1024
    const h = 1024
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!

    ctx.fillStyle = '#2a1d14'
    ctx.fillRect(0, 0, w, h)

    let seed = 7717
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    // Grain: long horizontal bands with a slow vertical wander.
    for (let i = 0; i < 260; i++) {
      const y = rand() * h
      const amp = 3 + rand() * 12
      const freq = 0.004 + rand() * 0.01
      const light = rand()
      ctx.strokeStyle =
        light > 0.72
          ? `rgba(120, 84, 54, ${0.1 + rand() * 0.16})`
          : `rgba(14, 9, 6, ${0.1 + rand() * 0.22})`
      ctx.lineWidth = 0.6 + rand() * 2.6
      ctx.beginPath()
      for (let x = 0; x <= w; x += 6) {
        // Wrap the wave to an integer period so the tile edges line up.
        const yy = y + Math.sin(x * freq + i) * amp + Math.sin((x / w) * Math.PI * 2) * 2
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }

    // A few knots to break up the regularity.
    for (let i = 0; i < 5; i++) {
      const cx = rand() * w
      const cy = rand() * h
      const r = 12 + rand() * 26
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r)
      g.addColorStop(0, 'rgba(10,6,4,0.55)')
      g.addColorStop(1, 'rgba(10,6,4,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat[0], repeat[1])
    tex.anisotropy = 8
    return tex
  }, [repeat[0], repeat[1]])
}
