import { Panel } from '../Panel'

type Film = {
  title: string
  kind: string
  year: string
  /** A YouTube/Vimeo embed URL. Left blank, the tile shows as a placeholder. */
  embed?: string
}

const FILMS: Film[] = [
  { title: 'Reel 2026', kind: 'Showreel', year: '2026' },
  { title: 'Short Film', kind: 'Director / Editor', year: '2025' },
  { title: 'Music Video', kind: 'DP', year: '2025' },
  { title: 'Brand Spot', kind: 'Edit & grade', year: '2024' },
]

export function Videography() {
  return (
    <Panel eyebrow="02 — Motion" title="Videography">
      <div className="filmgrid">
        {FILMS.map((f) => (
          <figure className="film" key={f.title}>
            <div className="film__frame">
              {f.embed ? (
                <iframe
                  src={f.embed}
                  title={f.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <span className="film__placeholder">Add embed URL</span>
              )}
            </div>
            <figcaption>
              <strong>{f.title}</strong>
              <span>
                {f.kind} · {f.year}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Panel>
  )
}
