import { useCallback, useEffect, useRef } from 'react'
import { useScene, type PropId } from '../store'

/**
 * Thin wrapper over a single HTMLAudioElement per prop.
 *
 * Drop-in files live in /public/audio (see the README there). A missing file is
 * deliberately non-fatal: the prop still animates, it just stays silent, so the
 * scene is fully explorable before any audio has been sourced.
 */
export function useAudio(id: PropId, src: string, opts: { loop?: boolean; volume?: number } = {}) {
  const { loop = false, volume = 0.6 } = opts
  const el = useRef<HTMLAudioElement | null>(null)
  const muted = useScene((s) => s.muted)
  const playing = useScene((s) => s.playing)
  const setPlaying = useScene((s) => s.setPlaying)

  const isPlaying = playing === id

  // Lazily construct so we never fetch audio the visitor hasn't asked for.
  const element = useCallback(() => {
    if (!el.current) {
      const a = new Audio(src)
      a.loop = loop
      a.volume = volume
      a.preload = 'none'
      a.addEventListener('ended', () => {
        if (useScene.getState().playing === id) setPlaying(null)
      })
      el.current = a
    }
    return el.current
  }, [src, loop, volume, id, setPlaying])

  const stop = useCallback(() => {
    const a = el.current
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    if (useScene.getState().playing === id) setPlaying(null)
  }, [id, setPlaying])

  const toggle = useCallback(() => {
    const a = element()
    if (useScene.getState().playing === id) {
      stop()
      return
    }
    setPlaying(id)
    a.currentTime = 0
    // Autoplay policy and 404s both land here — swallow, keep the visuals going.
    a.play().catch(() => {})
  }, [element, id, setPlaying, stop])

  // Another prop took over playback, or the visitor hit mute.
  useEffect(() => {
    const a = el.current
    if (!a) return
    if (!isPlaying || muted) {
      a.pause()
      if (!isPlaying) a.currentTime = 0
    } else if (a.paused) {
      a.play().catch(() => {})
    }
  }, [isPlaying, muted])

  useEffect(
    () => () => {
      el.current?.pause()
      el.current = null
    },
    [],
  )

  return { isPlaying, toggle, stop }
}
