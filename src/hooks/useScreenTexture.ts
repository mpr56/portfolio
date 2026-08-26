import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Paints the monitor's contents into a canvas texture.
 *
 * Deliberately not drei's <Text>/<Html>: troika pulls a font over the network
 * and Html breaks the bloom pass. A 2D canvas keeps the screen a real emissive
 * surface, so it lights the desk and blooms like a screen should.
 */
export function useScreenTexture(title: string, rows: string[], aspect = 3.5) {
  return useMemo(() => {
    // Must match the aspect of the plane in Monitor.tsx, or the text skews.
    const w = 1536
    const h = Math.round(w / aspect)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!

    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#141c28')
    bg.addColorStop(1, '#0a0f16')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(126,176,224,0.07)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#e8f0fb'
    ctx.font = '600 76px -apple-system, "Helvetica Neue", Arial, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(title, 100, 72)

    ctx.fillStyle = '#7fd4cf'
    ctx.fillRect(100, 172, 64, 6)

    ctx.fillStyle = 'rgba(232,240,251,0.58)'
    ctx.font = '400 34px -apple-system, "Helvetica Neue", Arial, sans-serif'
    rows.forEach((row, i) => ctx.fillText(row, 100, 218 + i * 52))

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [title, rows, aspect])
}
