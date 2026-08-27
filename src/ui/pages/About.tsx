import { Panel } from '../Panel'

export function About() {
  return (
    <Panel eyebrow="00 | Studio" title="About">
      <p className="lede">
        Current student at the University of Technology Sydney, studying a Bachelor of Computer Science (Cyber). I have a passion for software development and have been working in the field for the good part of 3 years. 
        <br/> <br/>
        Carrying a strong interest in web development, I have experience with a variety of technologies including React, Node.js, and TypeScript. 
        <br/> <br/>
        Apart from boring stuff I also have enormous passion for videography and have experience with video editing and production.
      </p>
      <p>
        I am always looking for new opportunities to learn and problems to tackle. I am eager to grow as a developer and I am excited to see what the future holds. If you are interested in working with me or just want to say hi, please feel free to reach out!
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
            <a href="mailto:manav.preet.contact@gmail.com">manav.preet.contact@gmail.com</a>
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
