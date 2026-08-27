import { Link } from 'react-router-dom'
import { Panel } from '../Panel'
import { PROJECTS } from '../../data/projects'

export function Projects() {
  return (
    <Panel eyebrow="01 | Work" title="Projects">
      <ul className="worklist">
        {PROJECTS.map((p) => (
          <li key={p.slug}>
            <Link className="worklist__item" to={`/projects/${p.slug}`}>
              <div className="worklist__head">
                <h3>{p.title}</h3>
                <span className="worklist__year">{p.year}</span>
              </div>
              <p className="worklist__role">{p.role}</p>
              <p className="worklist__blurb">{p.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
