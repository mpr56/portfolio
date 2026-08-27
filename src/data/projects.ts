
export type Project = {
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
    title: 'Property Hub',
    role: 'Frontend + Backend + Database',
    year: '2025',
    blurb: 'A dashboard built for property managers to track existing properties with every aspect of the property management lifecycle.',
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
    demo: { src: 'https://property-hub-demo.vercel.app', title: 'Property Dashboard Demo', zoom: 1 },
  },
  {
    slug: 'project-two',
    title: 'Receiptly (DEMO)',
    role: 'Frontend, Backend + AI integration',
    year: '2026',
    blurb: 'A simple app to scan and manage your receipts with AI ocr integration.',
    summary: `I got sick of loosing all of my receipts, so I built myself an app instead. This app combines the power of AI and OCR technology to provide a seamless experience for managing receipts. Users can easily scan, store, and categorize their receipts, making expense tracking effortless. This app is currently demo and the database has not been set up yet.`,
    stack: ['Next.js', 'TypeScript', 'AI Integration', 'Postgres'],
    highlights: ['Using AI-powered OCR for accurate receipt scanning', 'Ensuring data security and seperation for user data'],
    links: [{ label: 'Visit site', href: 'https://receiptly-store.vercel.app' }],
    demo: { src: 'https://receiptly-store.vercel.app', title: 'Receiptly Demo', zoom: 1 },
  },
  {
    slug: 'project-three',
    title: 'Project Three',
    role: 'Under development',
    year: '2026',
    blurb: 'Under development.',
    summary: 'Under development.',
    stack: ['Under development'],
  },
]
