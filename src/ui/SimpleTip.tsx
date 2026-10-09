import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useScene } from '../store'
import { toSimple } from '../view'

const SEEN_KEY = 'portfolio:simple-tip-seen'

const seen = () => {
  try {
    return !!localStorage.getItem(SEEN_KEY)
  } catch {
    return false
  }
}

const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Shows again next visit; harmless.
  }
}

/**
 * First-visit pointer to the simple view, for anyone who wants the information
 * without the room, or whose device is struggling with it. Sits opposite
 * <Onboarding /> in the same card style, and is dismissed the same way: once,
 * per device. Taking the link counts as dismissing it.
 */
export function SimpleTip() {
  const { pathname } = useLocation()
  const entered = useScene((s) => s.entered)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (entered && !seen()) setVisible(true)
  }, [entered])

  const dismiss = () => {
    markSeen()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="onboarding simpletip" role="status">
      <p className="onboarding__title">Just after the info?</p>
      <p className="onboarding__body">
        The simple view has the same projects, videos and contact details as plain pages, with no
        3D. Quicker to skim, and easier on older devices.
      </p>
      <div className="onboarding__actions">
        <Link className="onboarding__dismiss onboarding__go" to={toSimple(pathname)} onClick={markSeen}>
          Simple view →
        </Link>
        <button className="onboarding__dismiss" onClick={dismiss}>
          Got it
        </button>
      </div>
    </aside>
  )
}
