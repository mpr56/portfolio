import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { useScene } from '../store'

/**
 * Loading curtain. Lifts by itself the moment the models have decoded — there
 * is no Enter button, so the opening runs straight into the light-up sequence
 * in <ThemeDriver />.
 *
 * The one thing the old button did for free was give browsers the user gesture
 * that unlocks audio. Nothing plays on load anyway, so the mute toggle in the
 * HUD now serves as that gesture instead.
 */
export function Intro() {
  const { progress, active } = useProgress()
  const entered = useScene((s) => s.entered)
  const enter = useScene((s) => s.enter)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (entered || active || progress < 100) return
    // A beat on a full bar, so the load doesn't end on a jump cut.
    const t = setTimeout(enter, 220)
    return () => clearTimeout(t)
  }, [active, progress, entered, enter])

  // Stay mounted through the fade, then stop rendering entirely.
  useEffect(() => {
    if (!entered) return
    const t = setTimeout(() => setGone(true), 1000)
    return () => clearTimeout(t)
  }, [entered])

  if (gone) return null

  return (
    <div className={`intro ${entered ? 'is-gone' : ''}`} aria-hidden={entered}>
      <div className="intro__inner">
        <p className="intro__mark">Manav P.</p>
        <div className="intro__bar">
          <span style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }} />
        </div>
        <p>Explore by interacting with the objects. You can interact with (almost) everything!</p>
      </div>
    </div>
  )
}
