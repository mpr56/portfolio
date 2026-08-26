import { Link, useLocation } from 'react-router-dom'
import { useScene } from '../store'

const SoundIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z" strokeLinejoin="round" />
    {on ? (
      <>
        <path d="M15.4 9.2a4 4 0 0 1 0 5.6" strokeLinecap="round" />
        <path d="M17.9 6.8a7.5 7.5 0 0 1 0 10.4" strokeLinecap="round" />
      </>
    ) : (
      <path d="M16 9.8l4.6 4.6M20.6 9.8L16 14.4" strokeLinecap="round" />
    )}
  </svg>
)

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
          Solving problems
          <br />
          by breaking through the norms.
        </h1>
        <p>Software developer & inspiring videographer</p>
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
