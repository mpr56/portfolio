import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useLocation } from 'react-router-dom'
import { useScene, type PropId } from '../store'
import { HELP } from '../data/help'

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
 * No label floats here by default — the cursor is the affordance. Guided mode
 * (`help` in the store) is the one exception, and it shows every label at once
 * rather than one at a time on hover.
 */
/** How much a hovered prop grows. Small — this is a nudge, not a pop. */
const SCALE = 1.02

/** Gap between the top of a prop's bounding box and its guided-mode label. */
const LABEL_GAP = 0.07

/**
 * How far past the edge of the frame a label's anchor may sit before it is
 * dropped, in normalised device coordinates. Tighter than 1 because the label
 * is a box drawn around the anchor, not a point: without the inset, a prop near
 * the edge renders a label sliced in half by the viewport, which reads as a bug
 * rather than as framing. Matters on mobile, where the scrubber pans most of
 * the room off-screen.
 */
const EDGE = { x: 0.85, y: 0.9 }

const _box = new THREE.Box3()
const _ndc = new THREE.Vector3()

export function Interactive({ id, onActivate, passive = false, lift = 0.018, children }: Props) {
  const group = useRef<THREE.Group>(null)
  const anchor = useRef(new THREE.Vector3())
  const top = useRef(0)
  const anchored = useRef(false)
  const hovered = useScene((s) => s.hovered)
  const setHovered = useScene((s) => s.setHovered)
  const entered = useScene((s) => s.entered)
  const help = useScene((s) => s.help)
  const { pathname } = useLocation()
  const [labelAt, setLabelAt] = useState<THREE.Vector3 | null>(null)
  const [onScreen, setOnScreen] = useState(false)

  const clickable = !passive && Boolean(onActivate)
  const isHovered = hovered === id && entered && clickable

  const info = HELP[id]
  // Home framing only. Every other shot pushes the camera in close and drops a
  // panel over a third of the viewport, so labels there would sit under the
  // sheet or crowd the one prop the shot exists to show.
  const showLabel = Boolean(info) && help && entered && clickable && pathname === '/'

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

  useFrame(({ camera }, dt) => {
    const g = group.current
    if (!g) return

    // Measured once, on the first hover or the first time guided mode asks for
    // a label, by which point the GLBs have loaded.
    if ((isHovered || showLabel) && !anchored.current) {
      _box.setFromObject(g)
      if (!_box.isEmpty()) {
        _box.getCenter(anchor.current)
        top.current = _box.max.y
        anchored.current = true
      }
    }

    // Parked just above the prop's own box, so the label clears the model
    // instead of being buried in it. Derived from the same measurement as the
    // hover lift, which is what keeps labels tracking LAYOUT for free.
    if (showLabel && anchored.current && !labelAt) {
      setLabelAt(new THREE.Vector3(anchor.current.x, top.current + LABEL_GAP, anchor.current.z))
    }

    // Drop the label once its prop leaves the frame. Projecting per frame is
    // cheap; the state only moves when the answer changes, so panning costs a
    // render per label crossing the edge rather than one per frame.
    if (showLabel && labelAt) {
      _ndc.copy(labelAt).project(camera)
      const visible =
        _ndc.z < 1 && Math.abs(_ndc.x) < EDGE.x && Math.abs(_ndc.y) < EDGE.y
      if (visible !== onScreen) setOnScreen(visible)
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
      {showLabel && labelAt && info && onScreen && (
        <Html
          position={labelAt}
          center
          className="hotspot"
          wrapperClass="hotspot-anchor"
          zIndexRange={[9, 0]}
        >
          <span className="hotspot__cat">{info.category}</span>
          <span className="hotspot__act">{info.action}</span>
        </Html>
      )}
    </group>
  )
}
