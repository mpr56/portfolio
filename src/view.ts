/**
 * Which of the two sites a visitor gets: the 3D room, or the simple view at
 * /simple that renders the same content as plain pages with no WebGL at all.
 *
 * The simple view mirrors the room's routes under its own prefix, so any room
 * URL has a simple twin and a redirect never loses the visitor's place.
 */
export const SIMPLE_BASE = '/simple'

export const isSimplePath = (pathname: string) =>
  pathname === SIMPLE_BASE || pathname.startsWith(`${SIMPLE_BASE}/`)

export const toSimple = (pathname: string) =>
  pathname === '/' ? SIMPLE_BASE : `${SIMPLE_BASE}${pathname}`

const VIEW_KEY = 'portfolio:view'

/**
 * Sticky per device. Choosing the simple view once means a slow machine is not
 * made to download the room again on the next visit; "3D View" clears it.
 * Storage can throw in private modes, which just means nothing is remembered.
 */
export function rememberView(view: 'simple' | '3d') {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    // Not remembered; the default is fine.
  }
}

export function prefersSimple() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'simple'
  } catch {
    return false
  }
}

let webgl: boolean | undefined

/** Whether the room can render here at all. Probed once, then cached. */
export function hasWebGL() {
  if (webgl !== undefined) return webgl
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // Hand the context straight back; browsers cap how many can be live.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl = !!gl
  } catch {
    webgl = false
  }
  return webgl
}
