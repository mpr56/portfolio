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

  return (
    <Panel
      eyebrow={`${project.role} · ${project.year}`}
      title={project.title}
      backTo="/projects"
      backLabel="Back to projects"
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
