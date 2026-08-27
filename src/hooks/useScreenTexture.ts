import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

type Cover = { song: string; artist: string; url: string }

// Vite bundles every image placed here. The filename is deliberately the track
// metadata: `after-hours-the-weeknd.png` displays “After Hours” by
// “The Weeknd” without a second config.
const coverModules = import.meta.glob('../assets/spotify-covers/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const formatName = (value: string) =>
  value.replace(/[_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const covers: Cover[] = Object.entries(coverModules).map(([path, url]) => {
  const filename = path.split('/').pop()!.replace(/\.[^.]+$/, '')
  const [song, artist = 'Unknown artist'] = filename.split('-', 2)
  return { song: formatName(song), artist: formatName(artist), url }
})

/**
 * Paints the monitor's contents into a canvas texture.
 *
 * Deliberately not drei's <Text>/<Html>: troika pulls a font over the network
 * and Html breaks the bloom pass. A 2D canvas keeps the screen a real emissive
 * surface, so it lights the desk and blooms like a screen should.
 */
export function useScreenTexture(aspect = 3.5) {
  // Suspending until these are ready means the first texture upload already
  // contains the artwork — more reliable than mutating a live CanvasTexture.
  const coverTextures = useLoader(THREE.TextureLoader, covers.map((cover) => cover.url))
  const coverImages = useMemo(
    () => coverTextures.map((texture) => texture.image as HTMLImageElement),
    [coverTextures],
  )
  // Pick once per mounted scene, so a reload starts with a different record
  // without changing while React re-renders the monitor.
  const initialCoverIndex = useRef(covers.length ? Math.floor(Math.random() * covers.length) : 0).current
  const drawPlayer = useRef<(cover?: HTMLImageElement, song?: string, artist?: string) => void>(() => {})
  const textureRef = useRef<THREE.CanvasTexture | null>(null)

  const texture = useMemo(() => {
    // Must match the aspect of the plane in Monitor.tsx, or the text skews.
    const w = 1536
    const h = Math.round(w / aspect)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!

    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#111923')
    bg.addColorStop(1, '#090e15')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    const sans = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'
    const mono = '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    const leftW = 930

    const rect = (x: number, y: number, width: number, height: number, color: string, radius = 0) => {
      ctx.fillStyle = color
      if (!radius) return ctx.fillRect(x, y, width, height)
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, radius)
      ctx.fill()
    }
    const text = (value: string, x: number, y: number, font: string, color: string) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.fillText(value, x, y)
    }

    ctx.textBaseline = 'top'
    // Left: a restrained VS Code workspace.
    rect(24, 24, leftW - 40, h - 48, '#101720', 12)
    rect(24, 24, leftW - 40, 42, '#1b2531', 12)
    rect(24, 53, leftW - 40, 13, '#1b2531')
    ;['#ff625c', '#fdbc40', '#35c749'].forEach((color, index) => {
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(50 + index * 20, 45, 6, 0, Math.PI * 2)
      ctx.fill()
    })
    text('portfolio | Visual Studio Code', 130, 36, `500 16px ${sans}`, '#a9b7c6')
    rect(24, 66, 50, h - 90, '#161f2a')
    text('⌘', 41, 95, `500 19px ${sans}`, '#7d91a6')
    text('⌕', 42, 140, `500 23px ${sans}`, '#7d91a6')
    text('⑂', 41, 190, `500 20px ${sans}`, '#7d91a6')
    rect(74, 66, 166, h - 90, '#131c26')
    text('EXPLORER', 92, 86, `600 13px ${sans}`, '#7d91a6')
    text('▾  PORTFOLIO', 92, 120, `600 14px ${mono}`, '#d5e0eb')
    ;['  src', '    three', '    ui', '  public'].forEach((line, index) =>
      text(line, 92, 151 + index * 24, `400 14px ${mono}`, '#91a5b8'),
    )
    rect(240, 66, leftW - 280, 34, '#18232f')
    text('Monitor.tsx   ×', 262, 76, `500 14px ${sans}`, '#dce8f3')
    const code = [
      ['1', 'export function ', 'Monitor', '() {'],
      ['2', '  const ', 'projects', ' = useProjects()'],
      ['3', ''],
      ['4', '  return ('],
      ['5', '    <', 'Screen', ' active />'],
      ['6', '      <', 'Projects', ' />'],
      ['7', '    </', 'Screen', '>'],
      ['8', '  )'],
      ['9', '}'],
    ]
    code.forEach(([number, start, accent, end], index) => {
      const y = 118 + index * 25
      text(number, 260, y, `400 15px ${mono}`, '#53687d')
      text(start, 300, y, `400 15px ${mono}`, '#c9d6e3')
      if (accent) {
        const offset = ctx.measureText(start).width
        text(accent, 300 + offset, y, `500 15px ${mono}`, '#80d7d0')
        if (end) text(end, 300 + offset + ctx.measureText(accent).width, y, `400 15px ${mono}`, '#c9d6e3')
      }
    })

    // A small player gives the workspace a lived-in desktop feeling.
    const playerY = h - 142
    drawPlayer.current = (cover, song = 'Focus flow', artist = 'Spotify') => {
      rect(92, playerY, 450, 96, '#192d28', 10)
      if (cover) {
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(104, playerY + 12, 72, 72, 7)
        ctx.clip()
        ctx.drawImage(cover, 104, playerY + 12, 72, 72)
        ctx.restore()
      } else {
        rect(104, playerY + 12, 72, 72, '#70c9ad', 7)
        text('♪', 126, playerY + 27, `500 36px ${sans}`, '#10251f')
      }
      text('NOW PLAYING', 194, playerY + 17, `600 12px ${sans}`, '#70c9ad')
      text(song, 194, playerY + 36, `600 18px ${sans}`, '#f0faf5')
      text(`Spotify · ${artist}`, 194, playerY + 62, `400 14px ${sans}`, '#a3cabc')
      text('❚❚', 494, playerY + 39, `500 19px ${sans}`, '#d8f3e7')
    }
    drawPlayer.current(
      coverImages[initialCoverIndex],
      covers[initialCoverIndex]?.song,
      covers[initialCoverIndex]?.artist,
    )

    // Right: intentionally bright, spacious project call-to-action.
    const panelX = 930
    const panelW = w - panelX - 28
    const panel = ctx.createLinearGradient(panelX, 24, w, h - 24)
    panel.addColorStop(0, '#183f45')
    panel.addColorStop(1, '#10242e')
    rect(panelX, 24, panelW, h - 48, '#14323b', 14)
    ctx.fillStyle = panel
    ctx.beginPath()
    ctx.roundRect(panelX, 24, panelW, h - 48, 14)
    ctx.fill()
    text('SELECTED WORK', panelX + 42, 72, `600 14px ${sans}`, '#8be2d8')
    text('PROJECTS', panelX + 40, 108, `700 52px ${sans}`, '#f1fcfb')
    text('A closer look at the things', panelX + 42, 184, `400 17px ${sans}`, '#b7d3d4')
    text('I build for the web.', panelX + 42, 207, `400 17px ${sans}`, '#b7d3d4')
    rect(panelX + 40, h - 112, panelW - 80, 54, '#8ce0d7', 9)
    text('OPEN PROJECTS', panelX + 61, h - 96, `700 16px ${sans}`, '#10282f')
    text('↗', panelX + panelW - 76, h - 98, `600 23px ${sans}`, '#10282f')

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [aspect, coverImages, initialCoverIndex])

  useEffect(() => {
    textureRef.current = texture
    if (!covers.length || !coverImages.length) return

    let active = initialCoverIndex
    const paint = () => {
      drawPlayer.current(coverImages[active], covers[active].song, covers[active].artist)
      if (textureRef.current) textureRef.current.needsUpdate = true
    }
    paint()
    const interval = window.setInterval(() => {
      active = (active + 1) % coverImages.length
      paint()
    }, 7000)

    return () => {
      window.clearInterval(interval)
    }
  }, [texture, coverImages, initialCoverIndex])

  return texture
}
