import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = {
  title: string
  eyebrow?: string
  /** Where back and the scrim lead. Defaults to the scene. */
  backTo?: string
  backLabel?: string
  /**
   * Optional content for the open space beside the sheet — a live demo, say.
   * The scrim still shows through around it, so clicking past it still closes.
   */
  aside?: ReactNode
  children: ReactNode
}

/**
 * Shell for every content page. Sits over the canvas rather than replacing it,
 * so the scene keeps rendering and the camera move behind the panel stays
 * visible — that continuity is the whole point of the format.
 *
 * Three ways out, because one that only power users find is no way out: the
 * back button, clicking the scene beside the sheet, and Escape.
 */
export function Panel({
  title,
  eyebrow,
  backTo = '/',
  backLabel = 'Back to the desk',
  aside,
  children,
}: Props) {
  const navigate = useNavigate()
  const close = () => navigate(backTo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="panel" role="dialog" aria-modal="false" aria-label={title}>
      {/* Everything left of the sheet closes on click. Labelled rather than a
          bare div so it isn't a trap for keyboard and screen-reader users. */}
      <button className="panel__scrim" onClick={close} aria-label={`Close ${title}`} tabIndex={-1} />

      {aside && <div className="panel__aside">{aside}</div>}

      <div className="panel__sheet">
        <button className="panel__back" onClick={close}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel}
        </button>

        {eyebrow && <span className="panel__eyebrow">{eyebrow}</span>}
        <h2 className="panel__title">{title}</h2>
        <div className="panel__body">{children}</div>
      </div>
    </div>
  )
}
