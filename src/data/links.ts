/**
 * Where to find me off this site.
 *
 * One list, read by both the phone's lock screen and the Contact page, so the
 * two can never drift apart.
 */
export type SocialLink = {
  label: string
  /** The line under the label — a handle on the phone, the target on the page. */
  handle: string
  href: string
}

export const LINKS: SocialLink[] = [
  {
    label: 'GitHub',
    handle: '@manavpreet',
    href: 'https://github.com/manavpreet',
  },
  {
    label: 'LinkedIn',
    handle: 'Manav Preet',
    href: 'https://www.linkedin.com/in/manavpreet',
  },
  {
    label: 'Email',
    handle: 'manav.preet.contact@gmail.com',
    href: 'mailto:manav.preet.contact@gmail.com',
  },
]

/** Served straight out of public/. */
export const CV = {
  label: 'Download CV',
  handle: 'PDF',
  href: '/manav-cv.pdf',
}
