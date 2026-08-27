import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useScene, type PropId } from '../store'

type Props = {
  id: PropId
  onActivate?: () => void
  /**
   * Scenery. The prop is still named in the scene graph (so scripts/measure.mjs
   * can find it) but is removed from raycasting entirely — no cursor change, no
   * hover, and crucially it stops sitting in front of things behind it.
   */
  passive?: boolean
  /** How far the prop lifts on hover, in metres. 0 opts out of the lift. */
  lift?: number
  children: ReactNode
}

/**
 * Wraps a prop to give it the whole hover contract in one place: pointer
 * cursor, a small lift, and a click action.
 *
 * There is deliberately no floating label — the cursor is the affordance.
 */
/** How much a hovered prop grows. Small — this is a nudge, not a pop. */
const SCALE = 1.02

const _box = new THREE.Box3()

export function Interactive({ id, onActivate, passive = false, lift = 0.018, children }: Props) {
  const group = useRef<THREE.Group>(null)
  const anchor = useRef(new THREE.Vector3())
  const anchored = useRef(false)
  const hovered = useScene((s) => s.hovered)
  const setHovered = useScene((s) => s.setHovered)
  const entered = useScene((s) => s.entered)

  const clickable = !passive && Boolean(onActivate)
  const isHovered = hovered === id && entered && clickable

  // Opt the whole subtree out of raycasting. Cheaper and more reliable than
  // swallowing events, because the raycaster never considers these meshes.
  useLayoutEffect(() => {
    if (!group.current) return
    const noop = () => {}
    group.current.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      if (passive) {
        mesh.raycast = noop
      } else if (mesh.raycast === noop) {
        mesh.raycast = THREE.Mesh.prototype.raycast
      }
    })
  }, [passive, children])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return

    // Measured once, on the first hover, by which point the GLBs have loaded.
    if (isHovered && !anchored.current) {
      _box.setFromObject(g)
      if (!_box.isEmpty()) {
        _box.getCenter(anchor.current)
        anchored.current = true
      }
    }

    const s = THREE.MathUtils.damp(g.scale.x, isHovered ? SCALE : 1, 9, dt)
    const y = THREE.MathUtils.damp(g.position.y - anchor.current.y * (1 - g.scale.x), isHovered ? lift : 0, 9, dt)

    // This group sits at the world origin while its children carry their own
    // positions, so a bare scale would multiply those positions and slide the
    // prop sideways — out from under the cursor, which then un-hovers it.
    // Offsetting by anchor·(1−s) pins the scale to the prop's own centre.
    g.scale.setScalar(s)
    g.position.set(
      anchor.current.x * (1 - s),
      anchor.current.y * (1 - s) + y,
      anchor.current.z * (1 - s),
    )
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!entered || !clickable) return
    setHovered(id)
    document.body.style.cursor = 'pointer'
  }

  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (useScene.getState().hovered === id) setHovered(null)
    document.body.style.cursor = 'auto'
  }

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!entered || !onActivate) return
    onActivate()
  }

  if (passive) {
    return (
      <group name={id} ref={group}>
        {children}
      </group>
    )
  }

  return (
    <group name={id} ref={group} onPointerOver={over} onPointerOut={out} onClick={click}>
      {children}
    </group>
  )
}
