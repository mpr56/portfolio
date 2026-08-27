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
  links?: { label: string; href: string }[]
  image?: string
  demo?: {
    src: string
    title?: string
    zoom?: number
  }
}

export const PROJECTS: Project[] = [
  {
    slug: 'project-one',
    title: 'Project One',
    role: 'Frontend + Backend + Database',
    year: '2025',
    blurb: 'A short line about what it was and what you did on it.',
    summary:
      'A dashboard built for poperty managers to track exisitng properites with every aspect of the property management lifecycle. Syncs council rates, water bills, termite inpsections, periodic inspections and maintenance tasks with real time tracking and notifications so you never miss a thing. Built with React, Next.js and TypeScript.',
    stack: ['React', 'TypeScript', 'Next.js', 'Postgres'],
    highlights: [
      'Built a comprehensive and user-friendly property management dashboard.',
      'Implemented time sensitive notications for invoices and maintenance tasks.',
      'Integrated with multiple data sources for seamless operation.',
      'Used postgres to store and manage data efficiently, ensuring scalability and reliability.',
    ],
    links: [{ label: 'Visit site', href: 'https://property-hub-demo.vercel.app' }],
    demo: { src: 'https://property-hub-demo.vercel.app', title: 'Property Dashboard Demo', zoom: 0.85 },
  },
  {
    slug: 'project-two',
    title: 'Project Two',
    role: 'Front-end',
    year: '2026',
    blurb: 'Under development.',
    summary: 'Under development.',
    stack: ['Next.js', 'Postgres'],
    highlights: ['Under development.', 'Under development.'],
  },
  {
    slug: 'project-three',
    title: 'Project Three',
    role: 'Interaction',
    year: '2026',
    blurb: 'Under development.',
    summary: 'Under development.',
    stack: ['WebGL', 'GSAP'],
  },
]
