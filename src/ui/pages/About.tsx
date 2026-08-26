import { Panel } from '../Panel'

export function About() {
  return (
    <Panel eyebrow="00 — Studio" title="About">
      <p className="lede">
        A short paragraph about who you are and what you make. Two or three sentences is plenty —
        the scene has already done the talking.
      </p>
      <p>
        Follow it with the practical detail: what you work on, who you work with, and what someone
        should get in touch about.
      </p>

      <dl className="meta">
        <div>
          <dt>Based</dt>
          <dd>Sydney</dd>
        </div>
        <div>
          <dt>Working on</dt>
          <dd>Frontend and backend development</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <a href="mailto:manav.preet@gmail.com">manav.preet@gmail.com</a>
          </dd>
        </div>
      </dl>

      <p className="hint">
        Everything on the desk does something. Click the lamp for the lights, the record player and
        the guitars for sound, the monitor for work, and the cameras for film.
      </p>
    </Panel>
  )
}
