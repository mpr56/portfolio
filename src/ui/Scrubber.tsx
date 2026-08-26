import { useCallback, useRef } from 'react'
import { useScene } from '../store'

const Arrow = ({ dir }: { dir: -1 | 1 }) => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
    <path
      d={dir === -1 ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Mobile pan control.
 *
 * On a phone the desk cannot fit in frame, and a drag-to-look gesture competes
 * with the browser's own scrolling. An explicit scrubber sidesteps that: it
 * orbits the camera left and right (see <Rig />) and can be dragged or nudged
 * with the arrows.
 *
 * Hidden on pointer-precise, wide screens where the whole scene is visible.
 */
export function Scrubber() {
  const pan = useScene((s) => s.pan)
  const setPan = useScene((s) => s.setPan)
  const nudgePan = useScene((s) => s.nudgePan)
  const entered = useScene((s) => s.entered)
  const track = useRef<HTMLDivElement>(null)

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = track.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      setPan(((clientX - r.left) / r.width) * 2 - 1)
    },
    [setPan],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only while captured — otherwise a passing finger drags the camera.
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    setFromClientX(e.clientX)
  }

  // -1…1 → 0…100% of the track.
  const thumbPct = ((pan + 1) / 2) * 100

  return (
    <div className={`scrub ${entered ? 'is-ready' : ''}`} aria-hidden={!entered}>
      <button className="scrub__arrow" onClick={() => nudgePan(-0.28)} aria-label="Pan left">
        <Arrow dir={-1} />
      </button>

      <div
        ref={track}
        className="scrub__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="slider"
        aria-label="Pan the scene"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(pan * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') nudgePan(-0.12)
          if (e.key === 'ArrowRight') nudgePan(0.12)
        }}
      >
        <span className="scrub__thumb" style={{ left: `${thumbPct}%` }} />
      </div>

      <button className="scrub__arrow" onClick={() => nudgePan(0.28)} aria-label="Pan right">
        <Arrow dir={1} />
      </button>
    </div>
  )
}
