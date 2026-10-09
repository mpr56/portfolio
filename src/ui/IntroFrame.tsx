import { Link } from 'react-router-dom'
import { SIMPLE_BASE } from '../view'

type Props = {
  /** 0–100. */
  progress: number
  gone?: boolean
}

/**
 * The loading screen's markup, kept free of three.js so <App /> can show it
 * while the room's own chunk is still downloading, before <Intro /> exists.
 */
export function IntroFrame({ progress, gone = false }: Props) {
  return (
    <div className={`intro ${gone ? 'is-gone' : ''}`} aria-hidden={gone}>
      <div className="intro__inner">
        <p className="intro__mark">Manav P.</p>
        <div className="intro__bar">
          <span style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }} />
        </div>
        <p style={{ textAlign: 'center' }}>
          Explore by interacting with the objects.
          <br /> You can interact with (almost) everything!
          <br /> (website starts muted)
        </p>
        {/* The way out for a slow device, offered while it is still loading. */}
        <Link className="intro__simple" to={SIMPLE_BASE}>
          Just the info? Simple view →
        </Link>
      </div>
    </div>
  )
}
