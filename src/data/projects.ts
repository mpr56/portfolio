/**
 * Project content. Replace with real work — every field except `slug`, `title`
 * and `year` is optional, and the detail view drops whatever is missing rather
 * than rendering an empty heading.
 */
export type Project = {
  /** URL fragment, so a project can be linked to directly. */
  slug: string
  title: string
  role: string
  year: string
  /** One line, shown in the list. */
  blurb: string
  /** A few sentences, shown when the project is opened. */
  summary?: string
  stack?: string[]
  /** Bullets: what you actually did. */
  highlights?: string[]
  /**
   * Buttons under "Links". Leave this off entirely and the whole section
   * disappears — that is how a project opts out of having a visit link.
   */
  links?: { label: string; href: string }[]
  /** Optional hero image, e.g. "/work/one.jpg" in public/. */
  image?: string
  /**
   * A live demo, shown in the open space beside the write-up. `src` is any URL
   * that allows being framed — your own deployments will, most third-party
   * sites will not, since they send X-Frame-Options. Leave `src` empty to get
   * the placeholder box while the deployment is still being set up.
   */
  demo?: {
    src: string
    title?: string
    /**
     * Scales the embedded page. Below 1 zooms *out*: the frame is handed a
     * proportionally larger logical viewport and then scaled down, so more of
     * the site fits without it rendering its own mobile layout. Around 0.7–0.8
     * suits a dashboard; 1 leaves it at native size.
     */
    zoom?: number
  }
}

export const PROJECTS: Project[] = [
  {
    slug: 'project-one',
    title: 'Project One',
    role: 'Design & build',
    year: '2026',
    blurb: 'A short line about what it was and what you did on it.',
    summary:
      'Two or three sentences on the problem, who it was for, and what made it interesting. Keep the setup brief — the highlights below are where the detail belongs.',
    stack: ['React', 'TypeScript', 'Three.js'],
    highlights: [
      'The thing you built that you are most pleased with.',
      'A constraint you worked around, and how.',
      'A result — a number if you have one.',
    ],
    links: [{ label: 'Visit site', href: 'https://property-hub-demo.vercel.app' }],
    demo: { src: 'https://property-hub-demo.vercel.app', title: 'Dashboard demo', zoom: 0.75 },
  },
  {
    slug: 'project-two',
    title: 'Project Two',
    role: 'Front-end',
    year: '2025',
    blurb: 'Another one. Keep these to a sentence — the work should carry it.',
    summary: 'What it was, and why it mattered.',
    stack: ['Next.js', 'Postgres'],
    highlights: ['Something specific.', 'Something else specific.'],
  },
  {
    slug: 'project-three',
    title: 'Project Three',
    role: 'Interaction',
    year: '2025',
    blurb: 'Third slot. Add a link and it becomes clickable automatically.',
    summary: 'Short description of the work.',
    stack: ['WebGL', 'GSAP'],
  },
]
