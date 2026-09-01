
export type Project = {
  slug: string
  title: string
  role: string
  year: string
  blurb: string
  summary?: string
  stack?: string[]
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
    role: 'Frontend + Backend + Database + Google integration',
    year: '2025',
    blurb: 'A dashboard built for property managers to track existing properties with every aspect of the property management lifecycle.',
    summary:
      'A dashboard built for property managers to track existing properties with every aspect of the property management lifecycle. Syncs council rates, water bills, termite inspections, periodic inspections and maintenance tasks with real time tracking and notifications so you never miss a thing. Built with React, Next.js and TypeScript. This is a demo version of the real thing due to the sensitivity of the data, everything else is identical.',
    stack: ['React', 'TypeScript', 'Next.js', 'Postgres'],
    highlights: [
      'Built a comprehensive and user-friendly property management dashboard.',
      'Implemented time sensitive notifications for invoices and maintenance tasks.',
      'Integrated with multiple data sources for seamless operation.',
      'Used postgres to store and manage data efficiently, ensuring scalability and reliability.',
    ],
    links: [{ label: 'Visit site', href: 'https://property-hub-demo.vercel.app' }],
    demo: { src: 'https://property-hub-demo.vercel.app', title: 'Property Dashboard Demo', zoom: 1 },
  },
  {
    slug: 'project-two',
    title: 'Receiptify (DEMO)',
    role: 'Frontend + Backend + AI integration',
    year: '2026',
    blurb: 'A simple app to scan and manage your receipts with AI ocr integration.',
    summary: `I got sick of losing all of my receipts, so I built myself an app instead. This app combines the power of AI and OCR technology to provide a seamless experience for managing receipts. Users can easily scan, store, and categorise their receipts, making expense tracking effortless. This app is currently in demo phase and the database has not been set up yet.`,
    stack: ['Next.js', 'TypeScript', 'AI Integration', 'Postgres'],
    highlights: ['Using AI-powered OCR for accurate receipt scanning', 'Ensuring data security and separation for user data'],
    links: [{ label: 'Visit site', href: 'https://receiptify-store.vercel.app' }],
    demo: { src: 'https://receiptify-demo.vercel.app', title: 'Receiptify Demo', zoom: 1 },
  },
  {
    slug: 'this-site',
    title: 'This Site',
    role: 'Design + engineering + asset pipeline',
    year: '2026',
    blurb: 'The room you are sitting in — a real-time 3D portfolio where every object on the desk is a way into the work.',
    summary:
      'A single WebGL scene that never tears down. The canvas lives outside the router, so opening a page swaps the panel over the top and eases the camera to a new framing rather than unmounting the room — that continuity is the whole format. Every object on the desk is a door: the monitor opens the work, the cameras open the film, the lamp turns the room to night. The scene was the easy half. The interesting half was making it load fast enough to be worth shipping.',
    stack: ['React', 'TypeScript', 'three.js', 'React Three Fiber', 'Vite', 'Zustand'],
    highlights: [
      'Built an asset pipeline that takes 174MB of raw downloads to roughly 4MB shipped — texture resizing and WebP encoding, geometry simplification, and Draco compression.',
      'Converted models authored against the retired KHR_materials_pbrSpecularGlossiness extension, which three.js no longer supports and which render untextured white until they are migrated.',
      'Baked real-world scale and a floor-centred origin into every asset offline, so the scene code carries no per-model magic numbers — props sit at their layout position and that is all.',
      'Drove the day/night system off a single shared 0..1 mix that every material samples inside the render loop instead of React state, so toggling the lamp never re-renders the scene graph.',
      'Wrote the tooling around it: measuring world bounds of props in the running scene, screenshotting from arbitrary angles, and regenerating model credits from embedded licence metadata.',
    ],
  },
  {
    slug: 'project-three',
    title: 'No Trust Media',
    role: 'Under development',
    year: '2026',
    blurb: 'on the way.',
    summary: 'on the way.',
    stack: ['on the way'],
    links: [{ label: 'Visit site', href: 'https://notrustmedia.com' }],
    demo: { src: 'https://notrustmedia.com', title: 'No Trust Media Demo', zoom: 1 },
  },
  {
    slug: 'project-four',
    title: 'Plenty more on the way',
    role: 'Under development',
    year: '2026',
    blurb: 'Under development.',
    summary: 'Under development.',
    stack: ['Under development'],
  },
]
