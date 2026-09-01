import { Panel } from '../Panel'
import { CV, LINKS } from '../../data/links'

/**
 * Where the phone leads. Everything here leaves the site, so each row is a
 * plain external anchor rather than a route.
 */
export function Contact() {
  return (
    <Panel eyebrow="03 | Reach" title="Contact">
      <p className="lede">
        The quickest way to reach me is email. Everything I build in the open is on GitHub, and the
        CV has the full history if you need it in one page.
      </p>

      <ul className="contactlist">
        {[...LINKS, CV].map((link) => {
          const external = link.href.startsWith('http')
          return (
            <li key={link.href}>
              <a
                href={link.href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                {...(link === CV ? { download: '' } : {})}
              >
                <span className="contactlist__label">{link.label}</span>
                <span className="contactlist__handle">{link.handle}</span>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </li>
          )
        })}
      </ul>

      <p className="hint">
        Based in Sydney. Open to graduate and junior roles, and to anything interesting alongside
        study.
      </p>
    </Panel>
  )
}
