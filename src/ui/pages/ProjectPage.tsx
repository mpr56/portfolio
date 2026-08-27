import type { CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Panel } from '../Panel'
import { PROJECTS } from '../../data/projects'

/**
 * A single project, on its own screen. Reached from the Projects list at
 * /projects/:slug, so each one is directly linkable and the browser's own
 * back button steps back to the list.
 */
export function ProjectPage() {
  const { slug } = useParams()
  const project = PROJECTS.find((p) => p.slug === slug)

  if (!project) {
    return (
      <Panel eyebrow="01 — Work" title="Not found" backTo="/projects" backLabel="Back to projects">
        <p>That project doesn’t exist. It may have been renamed.</p>
      </Panel>
    )
  }

  // Lives in the open space beside the sheet rather than inside it, so the
  // demo gets the room it needs and the write-up stays readable next to it.
  const demo = project.demo ? (
    <figure className="demo">
      {/* The zoom is a scale on the iframe paired with an inverse size, so the
          embedded page lays out at a bigger viewport and is drawn smaller —
          rather than being squeezed into a narrow one and flipping to its own
          mobile layout. */}
      <div
        className="demo__frame"
        style={{ '--demo-zoom': project.demo.zoom ?? 1 } as CSSProperties}
      >
        {project.demo.src ? (
          <iframe
            src={project.demo.src}
            title={project.demo.title ?? `${project.title} demo`}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <span className="demo__placeholder">Website demo goes in this box</span>
        )}
      </div>
      {project.demo.title && <figcaption>{project.demo.title}</figcaption>}
    </figure>
  ) : null

  return (
    <Panel
      eyebrow={`${project.role} · ${project.year}`}
      title={project.title}
      backTo="/projects"
      backLabel="Back to projects"
      aside={demo}
    >
      {project.image && <img className="work__image" src={project.image} alt="" loading="lazy" />}

      {project.summary && <p className="lede">{project.summary}</p>}

      {project.highlights?.length ? (
        <section className="work__section">
          <h3>What I did</h3>
          <ul className="work__list">
            {project.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {project.stack?.length ? (
        <section className="work__section">
          <h3>Built with</h3>
          <ul className="work__tags">
            {project.stack.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {project.links?.length ? (
        <section className="work__section">
          <h3>Links</h3>
          <div className="work__links">
            {project.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </Panel>
  )
}
