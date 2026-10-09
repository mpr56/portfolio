/**
 * Quick answers for the simple view's FAQs page. Written for someone skimming
 * (a recruiter, say) who wants the facts without opening every page.
 */
export type Faq = {
  question: string
  answer: string
  /** Optional link shown after the answer. */
  link?: { label: string; href: string }
}

export const FAQS: Faq[] = [
  {
    question: 'Who are you?',
    answer:
      'Manav, a Computer Science (Cyber) student at UTS in Sydney. I have been working as a software developer for the good part of 3 years, and I shoot and edit video on the side.',
  },
  {
    question: 'Are you open to work?',
    answer:
      'Yes. I am open to graduate and junior roles, and to anything interesting alongside study.',
  },
  {
    question: 'What do you work with?',
    answer:
      'Mostly React, TypeScript and Next.js on the front end. On the back end: Node.js, Python with FastAPI, Postgres, Supabase and AWS.',
  },
  {
    question: 'Can I see your CV?',
    answer: 'It covers the full history on one page.',
    link: { label: 'Download the CV (PDF)', href: '/2026_resume.pdf' },
  },
  {
    question: 'What is the 3D view?',
    answer:
      'The full version of this site: a real-time 3D room where every object on the desk opens a page. It needs a reasonably modern device. This simple view has the same content without the 3D.',
  },
  {
    question: 'What is the best way to reach you?',
    answer: 'Email. GitHub and LinkedIn are on the Contact page too.',
    link: { label: 'manav.preet.contact@gmail.com', href: 'mailto:manav.preet.contact@gmail.com' },
  },
]
