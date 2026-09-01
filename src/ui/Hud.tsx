import { Link, useLocation } from 'react-router-dom'
import { useScene } from '../store'
import { SoundIcon } from './SoundIcon'

/** Persistent chrome: sound, menu, headline, footer, and the side tab. */
export function Hud() {
  const { pathname } = useLocation()
  const muted = useScene((s) => s.muted)
  const toggleMuted = useScene((s) => s.toggleMuted)
  const dark = useScene((s) => s.dark)
  const entered = useScene((s) => s.entered)
  const home = pathname === '/'

  return (
    <div className={`hud ${dark ? 'is-dark' : ''} ${entered ? 'is-entered' : ''}`}>
      <button
        className="chip chip--tl"
        onClick={toggleMuted}
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={!muted}
      >
        <SoundIcon on={!muted} />
      </button>

      <Link
        className="chip chip--tr"
        to={home ? '/about' : '/'}
        aria-label={home ? 'Open menu' : 'Close'}
      >
        {home ? (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
            <circle cx="6" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="18" cy="12" r="1.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        )}
      </Link>

      <header className={`headline ${home ? '' : 'headline--out'}`}>
        <h1>
          Making things. Breaking things. 
          <br />
          Learning everything along the way.
        </h1>
        <p>Full time Software developer, full time UTS student & aspiring videographer</p>
      </header>

      <Link className="sidetab" to="/about">
        <span className="sidetab__mark">M.</span>
        <span className="sidetab__label">About</span>
      </Link>

      <footer className="footer">
        © {new Date().getFullYear()} Manav. All rights reserved. <Link to="/about">About</Link>
      </footer>
    </div>
  )
}
