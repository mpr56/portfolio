/**
 * Videos in `public/videos` are served from `/videos/...`.
 * Add a new entry here for every clip you want to show on the Videography page.
 */
export type Video = {
  title: string
  kind: string
  year: string
  src: string
  poster?: string
}

export const VIDEOS: Video[] = [
  {
    title: 'No Trust Promo',
    kind: 'Video',
    year: '2026',
    src: '/videos/compress_multi_frame.mp4',
  },
]
