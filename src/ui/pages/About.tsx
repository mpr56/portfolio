import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '../Panel'
import { ABOUT } from '../../data/about'

export function About() {
  return (
    <Panel eyebrow="00 | Studio" title="About">
      <p className="lede">
        {ABOUT.lede.map((para, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <>
                <br /> <br />
              </>
            )}
            {para}
          </Fragment>
        ))}
      </p>
      <p>{ABOUT.body}</p>

      <dl className="meta">
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
            <Link to="/contact">Email, GitHub, LinkedIn & CV</Link>
          </dd>
        </div>
      </dl>

      <p className="hint">
        Everything on the desk does something. Click the lamp for the lights, the record player and
        the guitars for sound, the monitor for work, the cameras for film, and the phone to get in
        touch.
      </p>
    </Panel>
  )
}
