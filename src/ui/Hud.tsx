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
  const xray = useScene((s) => s.xray)
  const toggleXray = useScene((s) => s.toggleXray)
  const stats = useScene((s) => s.stats)
  const help = useScene((s) => s.help)
  const toggleHelp = useScene((s) => s.toggleHelp)
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

      <button
        className={`chip chip--tl2 ${xray ? 'is-on' : ''}`}
        onClick={toggleXray}
        aria-label={xray ? 'Leave wireframe view' : 'See how this was built'}
        aria-pressed={xray}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2.6 3.6 7.3v9.4L12 21.4l8.4-4.7V7.3L12 2.6Z" strokeLinejoin="round" />
          <path d="M3.6 7.3 12 12l8.4-4.7M12 12v9.4" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        className={`chip chip--tl3 ${help ? 'is-on' : ''}`}
        onClick={toggleHelp}
        aria-label={help ? 'Hide the guide' : 'Show what can be clicked'}
        aria-pressed={help}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.3a2.6 2.6 0 0 1 5.1.8c0 1.7-2.6 2.2-2.6 3.8" strokeLinecap="round" />
          <circle cx="12" cy="17.2" r="0.95" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {xray && (
        <aside className="xray">
          <p className="xray__title">Wireframe</p>
          <dl className="xray__stats">
            <div>
              <dt>Triangles</dt>
              <dd>{stats.triangles.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Meshes</dt>
              <dd>{stats.meshes.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Geometries</dt>
              <dd>{stats.geometries.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Textures</dt>
              <dd>{stats.textures.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="xray__note">
            Every model here was rebuilt offline — 174MB of raw downloads to roughly 4MB shipped.
            The cone is the lamp&rsquo;s spotlight, drawn from the same numbers that aim it.
          </p>
          <Link className="xray__link" to="/projects/this-site">
            How it was built →
          </Link>
        </aside>
      )}

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

      {/* Guided mode borrows the same exit the panels use: the labels sit where
          the headline does, and the two together are unreadable. */}
      <header className={`headline ${home && !help ? '' : 'headline--out'}`}>
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
