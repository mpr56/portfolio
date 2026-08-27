import { Panel } from '../Panel'
import { VIDEOS } from '../../data/videos'
import { useScene } from '../../store'
import { SoundIcon } from '../SoundIcon'

export function Videography() {
  const muted = useScene((s) => s.muted)
  const toggleMuted = useScene((s) => s.toggleMuted)

  return (
    <Panel
      eyebrow="02 | Motion"
      title="Videography"
      actions={
        <button
          className="panel__mute"
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute videos' : 'Mute videos'}
          aria-pressed={!muted}
        >
          <SoundIcon on={!muted} />
        </button>
      }
    >
      <div className="filmgrid">
        {VIDEOS.map((f) => (
          <figure className="film" key={f.title}>
            <div className="film__frame">
              <video controls loop muted={muted} playsInline preload="auto" poster={f.poster}>
                <source src={f.src} type="video/mp4" />
                Your browser does not support HTML video.
              </video>
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
