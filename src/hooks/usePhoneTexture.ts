import { useMemo } from 'react'
import * as THREE from 'three'
import { Resume, LINKS } from '../data/links'

/**
 * Paints the phone's lock screen into a canvas texture.
 *
 * Same approach as the monitor, for the same reasons: a 2D canvas keeps the
 * screen a real emissive surface, so it lights the desk and blooms like a
 * screen should. drei's <Html> would break the bloom pass and <Text> would
 * pull a font over the network.
 */
export function usePhoneTexture(aspect: number) {
  return useMemo(() => {
    // Height-first, unlike the monitor: this panel is portrait, so deriving
    // width from a fixed height is what keeps the pixel budget sane.
    const h = 1280
    const w = Math.round(h * aspect)

    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!

    const sans = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'
    const accent = '#7fe3d4'

    const rect = (x: number, y: number, width: number, height: number, color: string, radius = 0) => {
      ctx.fillStyle = color
      if (!radius) return ctx.fillRect(x, y, width, height)
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, radius)
      ctx.fill()
    }
    const text = (
      value: string,
      x: number,
      y: number,
      font: string,
      color: string,
      align: CanvasTextAlign = 'left',
    ) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = align
      ctx.fillText(value, x, y)
    }

    /**
     * The glass has a large corner radius, but the panel carrying this texture
     * is a plain rectangle. Drawn corner to corner, the lit image overhangs the
     * rounded bezel at all four corners, which is what makes the screen read as
     * a decal stuck on the front rather than as the display behind the glass.
     *
     * So: flood the whole canvas with the black the bezel already is, then clip
     * everything else to the rounded rect. The corners stay dark and vanish
     * into the frame, and staying opaque keeps the model's own baked wallpaper
     * hidden underneath — which a transparent cut-out would have revealed.
     */
    const RADIUS = 0.115
    ctx.fillStyle = '#05070a'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, w * RADIUS)
    ctx.clip()

    const bg = ctx.createLinearGradient(0, 0, w * 0.6, h)
    bg.addColorStop(0, '#16323a')
    bg.addColorStop(0.55, '#101c26')
    bg.addColorStop(1, '#0a1017')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    ctx.textBaseline = 'top'

    // Real clock rather than a placeholder time — it is built once per mount,
    // so it is honest at the moment someone first picks the phone up.
    const now = new Date()
    const clock = now.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const date = now.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    text(date, w / 2, 126, `500 26px ${sans}`, 'rgba(226,240,244,0.62)', 'center')
    text(clock, w / 2, 162, `200 132px ${sans}`, '#f2f8fa', 'center')

    // Notification stack: the three links plus the CV, as things that arrived
    // on the phone rather than as a nav bar pretending to be one.
    const rows = [...LINKS, Resume]
    const pad = 34
    const cardH = 118
    const gap = 14
    let y = 470

    for (const row of rows) {
      rect(pad, y, w - pad * 2, cardH, 'rgba(255,255,255,0.075)', 22)
      rect(pad + 20, y + 26, 66, 66, 'rgba(127,227,212,0.16)', 17)
      text(row.label.slice(0, 1), pad + 53, y + 43, `700 30px ${sans}`, accent, 'center')
      text(row.label, pad + 104, y + 32, `600 27px ${sans}`, '#eef6f8')

      // Long addresses would otherwise run off the glass.
      ctx.font = `400 22px ${sans}`
      let handle = row.handle
      const room = w - pad * 2 - 124
      while (handle.length > 4 && ctx.measureText(handle).width > room) {
        handle = handle.slice(0, -1)
      }
      if (handle !== row.handle) handle = `${handle.slice(0, -1)}…`
      text(handle, pad + 104, y + 68, `400 22px ${sans}`, 'rgba(226,240,244,0.55)')

      y += cardH + gap
    }

    text('Tap to open', w / 2, h - 132, `500 23px ${sans}`, 'rgba(226,240,244,0.42)', 'center')
    rect(w / 2 - 62, h - 74, 124, 6, 'rgba(255,255,255,0.3)', 3)

    ctx.restore()

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [aspect])
}
