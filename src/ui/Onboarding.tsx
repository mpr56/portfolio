import { useEffect, useState } from 'react'
import { useScene } from '../store'

const SEEN_KEY = 'portfolio:guide-seen'

/**
 * First-visit tip. Surfaces the two chips that are easy to miss — guided
 * mode and the wireframe view — rather than repeating what the loading
 * screen already said. Dismissing it writes to localStorage so it never
 * shows again on this device.
 */
export function Onboarding() {
  const entered = useScene((s) => s.entered)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (entered && !localStorage.getItem(SEEN_KEY)) setVisible(true)
  }, [entered])

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="onboarding" role="status">
      <p className="onboarding__title">A couple of things</p>
      <p className="onboarding__body">
        Click almost anything in the room to explore it. The <strong>?</strong> chip (top-left)
        lights up everything clickable if you get stuck. The wireframe chip next to it shows how
        the site itself was built.
      </p>
      <button className="onboarding__dismiss" onClick={dismiss}>
        Got it
      </button>
    </aside>
  )
}
