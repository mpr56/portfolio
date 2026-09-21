import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useLocation } from 'react-router-dom'
import { FrameBudget } from './frameBudget'
import { intro } from './theme'
import { useScene } from '../store'
import { TAIL_INPUT, TAIL_TRANSITION, hold, isMoving, poke, useQuality } from '../quality'

/**
 * The only requestAnimationFrame loop in the app.
 *
 * The scene used to render at the display's refresh rate forever — 120fps on a
 * ProMotion Mac, for a room that is almost always perfectly still. Nothing here
 * changes what a frame contains; it changes how often one is asked for.
 *
 * frameloop="demand" would have been simpler and is not available: Plant.tsx
 * sways on a sine that never stops, and the damps in Rig.tsx and theme.ts are
 * asymptotic, so the scene is never exactly still and demand would render
 * every frame anyway.
 */

/**
 * While a route sheet is open, styles.css puts a 22px backdrop blur over the
 * canvas. The scene behind it is already past legibility, so it gets the
 * cheapest treatment in the app.
 */
const SHEET_FPS = 15
const SHEET_DPR = 0.75

/**
 * Slack on the frame-due test, in ms.
 *
 * Without it a 60fps target on a 60Hz display drops every other frame: rAF
 * deltas jitter either side of 16.67, and half of them land just under the
 * interval and get skipped, halving the rate.
 */
const SLACK = 2

/** How long the opening sequence is treated as active. theme.ts:71 ramps the
 *  lights over roughly two seconds and it is the first thing anyone sees. */
const INTRO_ACTIVE_UNTIL = 2.4

export function FrameDriver() {
  const advance = useThree((s) => s.advance)
  const setDpr = useThree((s) => s.setDpr)
  const demote = useQuality((s) => s.demote)
  const dynamic = useQuality((s) => s.dynamic)
  const { pathname } = useLocation()
  const playing = useScene((s) => s.playing)

  const sheet = pathname !== '/'

  // Read inside the loop rather than closed over, so changing either does not
  // tear down and restart the rAF loop.
  const profile = useRef(dynamic)
  profile.current = dynamic
  const sheetOpen = useRef(sheet)
  sheetOpen.current = sheet

  // A record spinning or an engine idling runs until stopped, so it is a hold
  // rather than a poke — a poke would expire halfway through the track.
  useEffect(() => {
    if (!playing) return
    return hold()
  }, [playing])

  // Any state the visitor can change is a transition worth smoothing: the
  // theme dissolve, the sign fading, x-ray coming on, the mobile scrubber.
  useEffect(
    () =>
      useScene.subscribe((state, previous) => {
        if (
          state.hovered !== previous.hovered ||
          state.dark !== previous.dark ||
          state.signOn !== previous.signOn ||
          state.xray !== previous.xray ||
          state.help !== previous.help ||
          state.pan !== previous.pan ||
          state.entered !== previous.entered
        ) {
          poke(state.dark !== previous.dark ? TAIL_TRANSITION : TAIL_INPUT)
        }
      }),
    [],
  )

  // A route change eases the camera across the room over about a second and a
  // half, and that is the most visible motion in the app.
  useEffect(() => {
    poke(TAIL_TRANSITION)
  }, [pathname])

  // Pointer movement drives the camera parallax in Rig.tsx, so it is motion
  // even when nothing is clicked. Passive and on the window: the canvas fills
  // the viewport and this must not interfere with the scene's own picking.
  useEffect(() => {
    const onInput = () => poke()
    const opts = { passive: true } as const
    window.addEventListener('pointermove', onInput, opts)
    window.addEventListener('pointerdown', onInput, opts)
    window.addEventListener('wheel', onInput, opts)
    window.addEventListener('keydown', onInput, opts)
    window.addEventListener('resize', onInput, opts)
    return () => {
      window.removeEventListener('pointermove', onInput)
      window.removeEventListener('pointerdown', onInput)
      window.removeEventListener('wheel', onInput)
      window.removeEventListener('keydown', onInput)
      window.removeEventListener('resize', onInput)
    }
  }, [])

  // The driver owns DPR outright. <Canvas dpr> is set once at mount and never
  // again, because a re-render of Canvas would overwrite whatever is set here.
  useEffect(() => {
    setDpr(sheet ? dynamic.dpr * SHEET_DPR : dynamic.dpr)
  }, [setDpr, sheet, dynamic.dpr])

  useEffect(() => {
    const budget = new FrameBudget()
    const start = performance.now()
    let raf = 0
    let last = -Infinity

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)

      const moving =
        isMoving(now) || (intro.t >= 0 && intro.t < INTRO_ACTIVE_UNTIL)
      const target = moving
        ? profile.current.activeFps
        : sheetOpen.current
          ? SHEET_FPS
          : profile.current.idleFps

      if (now - last < 1000 / target - SLACK) return
      last = now

      // Seconds, not milliseconds. Under frameloop="never" R3F sets
      // clock.elapsedTime to this value and derives every useFrame delta from
      // it, so passing performance.now() would run Plant.tsx's sway a thousand
      // times too fast and snap every damp in the scene on the first frame.
      // Relative to the driver's start, so frame one gets a delta near zero.
      const t0 = performance.now()
      advance((now - start) / 1000)
      const cost = performance.now() - t0

      // Only frames rendered against the active target are judged. Cost
      // measured against a 30fps idle budget says nothing useful, and mixing
      // the two targets inside one window would make the median meaningless.
      if (moving && budget.sample(now, cost, profile.current.activeFps)) demote()
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [advance, demote])

  return null
}
