import { lazy, Suspense } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { IntroFrame } from './ui/IntroFrame'
import { SimpleSite } from './simple/SimpleSite'
import { hasWebGL, isSimplePath, prefersSimple, toSimple } from './view'

const Room = lazy(() => import('./Room'))

/**
 * Two sites over one set of content: the 3D room, and a plain simple view at
 * /simple for older devices and anyone who just wants the information. Only
 * the room pulls in three.js, so the simple view stays light.
 *
 * A browser with no WebGL, or a visitor who chose the simple view before, is
 * sent to the simple twin of whatever room URL they asked for.
 */
export default function App() {
  const { pathname } = useLocation()

  if (isSimplePath(pathname)) return <SimpleSite />
  if (prefersSimple() || !hasWebGL()) return <Navigate to={toSimple(pathname)} replace />

  return (
    // The room's chunk is the heavy one; the loading screen covers it too.
    <Suspense fallback={<IntroFrame progress={0} />}>
      <Room />
    </Suspense>
  )
}
