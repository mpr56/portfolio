import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ABOUT } from '../data/about'
import { FAQS } from '../data/faqs'
import { LINKS, Resume } from '../data/links'
import { PROJECTS } from '../data/projects'
import { VIDEOS } from '../data/videos'
import { hasWebGL, rememberView, SIMPLE_BASE } from '../view'
import './simple.css'

type Item = { id: string; label: string; hint: string; to: string }

/** The menu, top to bottom. "3D View" is the way into the room. */
const ITEMS: Item[] = [
  { id: 'about', label: 'About', hint: 'Who I am and what I do', to: `${SIMPLE_BASE}/about` },
  { id: 'projects', label: 'Projects', hint: 'Things I have built', to: `${SIMPLE_BASE}/projects` },
  {
    id: 'videography',
    label: 'Videography',
    hint: 'Film and edits',
    to: `${SIMPLE_BASE}/videography`,
  },
  { id: 'room', label: '3D View', hint: 'Step into the full 3D room', to: '/' },
  { id: 'faqs', label: 'FAQs', hint: 'Quick answers', to: `${SIMPLE_BASE}/faqs` },
  { id: 'contact', label: 'Contact', hint: 'Email, GitHub, LinkedIn and CV', to: `${SIMPLE_BASE}/contact` },
]

/**
 * The simple view: the room's content as plain pages, with no WebGL. A home
 * menu in the style of an old console boot screen, then one page per section.
 */
export function SimpleSite() {
  const { pathname } = useLocation()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => rememberView('simple'), [])

  // The page scrolls inside .simple, not the window, so reset it by hand.
  useEffect(() => {
    root.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="simple" ref={root}>
      <Routes>
        <Route path={SIMPLE_BASE} element={<Home />} />
        <Route path={`${SIMPLE_BASE}/about`} element={<AboutPage />} />
        <Route path={`${SIMPLE_BASE}/projects`} element={<ProjectsPage />} />
        <Route path={`${SIMPLE_BASE}/projects/:slug`} element={<ProjectDetail />} />
        <Route path={`${SIMPLE_BASE}/videography`} element={<VideographyPage />} />
        <Route path={`${SIMPLE_BASE}/faqs`} element={<FaqsPage />} />
        <Route path={`${SIMPLE_BASE}/contact`} element={<ContactPage />} />
        <Route path="*" element={<Navigate to={SIMPLE_BASE} replace />} />
      </Routes>
    </div>
  )
}

/* ------------------------------------------------------------------ menu */

/** The glowing cluster from the home screen; doubles as the logo in the nav. */
function Orbs({ small = false }: { small?: boolean }) {
  return (
    <div className={`orbs ${small ? 'orbs--small' : ''}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="orb" />
      ))}
    </div>
  )
}

/**
 * Renders a menu entry.
 *
 * "3D View" is a full page load rather than a route change, so the room starts
 * from scratch: fresh scene state, and the loading screen from the top. It also
 * clears the remembered preference so the room is not redirected straight back
 * here, and is inert where the browser cannot run it.
 */
function MenuLink({
  item,
  className,
  linkRef,
  ...handlers
}: {
  item: Item
  className: string
  linkRef?: (el: HTMLAnchorElement | null) => void
  onMouseEnter?: () => void
  onFocus?: () => void
}) {
  if (item.id === 'room') {
    if (!hasWebGL()) {
      return (
        <span className={`${className} is-disabled`} aria-disabled title="This browser can’t run the 3D room">
          {item.label}
        </span>
      )
    }
    return (
      <a className={className} href={item.to} ref={linkRef} onClick={() => rememberView('3d')} {...handlers}>
        {item.label}
      </a>
    )
  }
  return (
    <Link className={className} to={item.to} ref={linkRef} {...handlers}>
      {item.label}
    </Link>
  )
}

function Home() {
  const location = useLocation()
  // Coming back from a section highlights the one just left, like a game menu.
  const from = (location.state as { from?: string } | null)?.from
  const start = Math.max(0, ITEMS.findIndex((i) => i.id === (from ?? 'projects')))
  const [active, setActive] = useState(start)
  const links = useRef<(HTMLAnchorElement | null)[]>([])
  const activeRef = useRef(active)
  activeRef.current = active

  // Arrow keys walk the menu without having to tab into it first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      if (!step) return
      e.preventDefault()
      let next = activeRef.current
      // Skip anything inert (no link to focus), wrapping at either end.
      for (let n = 0; n < ITEMS.length; n++) {
        next = (next + step + ITEMS.length) % ITEMS.length
        if (links.current[next]) break
      }
      setActive(next)
      links.current[next]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="shome">
      <div className="shome__art">
        <Orbs />
      </div>

      <nav className="shome__menu" aria-label="Main menu">
        <ul>
          {ITEMS.map((item, i) => (
            <li key={item.id}>
              <MenuLink
                item={item}
                className={`smenu__item ${i === active ? 'is-active' : ''}`}
                linkRef={(el) => {
                  links.current[i] = el
                }}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
              />
            </li>
          ))}
        </ul>
        <p className="shome__hint" aria-hidden>
          {ITEMS[active].id === 'room' && !hasWebGL()
            ? 'This browser can’t run the 3D room'
            : ITEMS[active].hint}
        </p>
      </nav>

      <footer className="shome__foot">
        Manav P. · Software developer &amp; videographer · Sydney
      </footer>
    </main>
  )
}

/* ----------------------------------------------------------------- pages */

type PageProps = {
  /** Which menu entry this page belongs to. */
  section: string
  title: string
  eyebrow?: string
  /** Where back and Escape lead. Defaults to the menu. */
  back?: { to: string; label: string }
  children: ReactNode
}

/** Shell for every section: the menu as a side nav, then the content. */
function Page({ section, title, eyebrow, back, children }: PageProps) {
  const navigate = useNavigate()
  const backTo = back?.to ?? SIMPLE_BASE

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(backTo, { state: { from: section } })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, backTo, section])

  return (
    <div className="spage">
      <nav className="snav" aria-label="Sections">
        <Link className="snav__home" to={SIMPLE_BASE} state={{ from: section }} aria-label="Menu">
          <Orbs small />
        </Link>
        <ul>
          {ITEMS.map((item) => (
            <li key={item.id}>
              <MenuLink
                item={item}
                className={`snav__item ${item.id === section ? 'is-active' : ''}`}
              />
            </li>
          ))}
        </ul>
      </nav>

      <main className="sbody">
        <Link className="sbody__back" to={backTo} state={{ from: section }}>
          ← {back?.label ?? 'Menu'}
        </Link>
        {eyebrow && <p className="sbody__eyebrow">{eyebrow}</p>}
        <h1 className="sbody__title">{title}</h1>
        {children}
      </main>
    </div>
  )
}

const ExternalArrow = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function AboutPage() {
  return (
    <Page section="about" title="About">
      {ABOUT.lede.map((para) => (
        <p key={para} className="sbody__lede">
          {para}
        </p>
      ))}
      <p>{ABOUT.body}</p>
      <dl className="sfacts">
        <div>
          <dt>Based</dt>
          <dd>{ABOUT.based}</dd>
        </div>
        <div>
          <dt>Working on</dt>
          <dd>{ABOUT.workingOn}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <Link to={`${SIMPLE_BASE}/contact`}>Email, GitHub, LinkedIn &amp; CV</Link>
          </dd>
        </div>
      </dl>
    </Page>
  )
}

function ProjectsPage() {
  return (
    <Page section="projects" title="Projects">
      <ul className="slist">
        {PROJECTS.map((p) => (
          <li key={p.slug}>
            <Link className="slist__item" to={`${SIMPLE_BASE}/projects/${p.slug}`}>
              <span className="slist__head">
                <strong>{p.title}</strong>
                <span>{p.year}</span>
              </span>
              <span className="slist__role">{p.role}</span>
              <span className="slist__blurb">{p.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}

function ProjectDetail() {
  const { slug } = useParams()
  const project = PROJECTS.find((p) => p.slug === slug)
  const back = { to: `${SIMPLE_BASE}/projects`, label: 'Projects' }

  if (!project) {
    return (
      <Page section="projects" title="Not found" back={back}>
        <p>That project doesn’t exist. It may have been renamed.</p>
      </Page>
    )
  }

  return (
    <Page section="projects" title={project.title} eyebrow={`${project.role} · ${project.year}`} back={back}>
      {project.summary && <p className="sbody__lede">{project.summary}</p>}

      {/* The same live demo the room shows beside the sheet, inline here. It
          is drawn at half scale so the site lays out at a desktop width
          rather than flipping to its mobile layout in this narrow column. */}
      {project.demo?.src && (
        <figure className="sdemo">
          <div className="demo__frame sdemo__frame" style={{ '--demo-zoom': 0.5 } as CSSProperties}>
            <iframe
              src={project.demo.src}
              title={project.demo.title ?? `${project.title} demo`}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
          {project.demo.title && <figcaption>{project.demo.title} · live preview</figcaption>}
        </figure>
      )}

      {project.highlights?.length ? (
        <section className="ssection">
          <h2>What I did</h2>
          <ul className="sbullets">
            {project.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {project.stack?.length ? (
        <section className="ssection">
          <h2>Built with</h2>
          <p className="sstack">{project.stack.join(' · ')}</p>
        </section>
      ) : null}

      {project.links?.length ? (
        <section className="ssection">
          <h2>Links</h2>
          <ul className="slinks">
            {project.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label} <ExternalArrow />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  )
}

function VideographyPage() {
  return (
    <Page section="videography" title="Videography">
      <div className="sfilms">
        {VIDEOS.map((v) =>
          v.src ? (
            <figure className="sfilm" key={v.title}>
              {/* preload="none": nothing downloads until someone presses play. */}
              <video controls playsInline preload="none" poster={v.poster}>
                <source src={v.src} type="video/mp4" />
                Your browser does not support HTML video.
              </video>
              <figcaption>
                <strong>{v.title}</strong> {v.kind} · {v.year}
              </figcaption>
            </figure>
          ) : (
            <p className="sfilms__more" key={v.title}>
              {v.title}…
            </p>
          ),
        )}
      </div>
    </Page>
  )
}

function FaqsPage() {
  return (
    <Page section="faqs" title="FAQs">
      <dl className="sfaqs">
        {FAQS.map((f) => (
          <div key={f.question}>
            <dt>{f.question}</dt>
            <dd>
              {f.answer}
              {f.link && (
                <>
                  {' '}
                  <a href={f.link.href} {...(f.link.href.endsWith('.pdf') ? { download: '' } : {})}>
                    {f.link.label}
                  </a>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Page>
  )
}

function ContactPage() {
  return (
    <Page section="contact" title="Contact">
      <p className="sbody__lede">
        The quickest way to reach me is email. Everything I build in the open is on GitHub, and the
        CV has the full history if you need it in one page.
      </p>
      <ul className="slist">
        {[...LINKS, Resume].map((link) => {
          const external = link.href.startsWith('http')
          return (
            <li key={link.href}>
              <a
                className="slist__item slist__item--row"
                href={link.href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                {...(link === Resume ? { download: '' } : {})}
              >
                <strong>{link.label}</strong>
                <span className="slist__role">{link.handle}</span>
                <ExternalArrow />
              </a>
            </li>
          )
        })}
      </ul>
      <p className="sbody__note">
        Based in Sydney. Open to graduate and junior roles, and to anything interesting alongside
        study.
      </p>
    </Page>
  )
}
