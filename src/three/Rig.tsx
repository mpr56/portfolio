import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useLocation } from 'react-router-dom'
import { getShot } from '../data/scene'
import { useScene } from '../store'

const _pos = new THREE.Vector3()
const _target = new THREE.Vector3()

/** How far the mobile scrubber slides the view, in metres each way. */
const PAN_RANGE = 1.35

/**
 * Drives the camera. Two things are layered:
 *  1. the route's framing, eased so navigating reads as the camera moving in
 *  2. a small pointer parallax on top, which keeps the scene feeling hand-held
 */
export function Rig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const { pathname } = useLocation()
  const entered = useScene((s) => s.entered)
  const look = useRef(new THREE.Vector3(0, 0.86, 0))

  useFrame((state, dt) => {
    // Dev escape hatch: lets scripts/shot.mjs park the camera anywhere to
    // inspect a prop without the rig easing it back to the route framing.
    if (import.meta.env.DEV && (window as unknown as { __freezeCamera?: boolean }).__freezeCamera) {
      return
    }
    const shot = getShot(pathname)

    // Pointer parallax, dialled right down so it never fights the framing.
    const px = state.pointer.x * (entered ? 0.34 : 0.1)
    const py = state.pointer.y * (entered ? 0.2 : 0.06)

    _target.set(shot.target[0], shot.target[1], shot.target[2])
    _pos.set(shot.position[0] + px, shot.position[1] + py, shot.position[2])

    // Mobile scrubber: a lateral truck, not an orbit. Camera and target slide
    // together along the view's horizontal right vector, so the angle on every
    // object is unchanged and only the framing moves — orbiting would swing
    // the whole room around and turn the props as it went.
    const pan = useScene.getState().pan
    if (pan !== 0) {
      const dx = _pos.x - _target.x
      const dz = _pos.z - _target.z
      const len = Math.hypot(dx, dz) || 1
      const rx = dz / len
      const rz = -dx / len
      const shift = pan * PAN_RANGE
      _pos.x += rx * shift
      _pos.z += rz * shift
      _target.x += rx * shift
      _target.z += rz * shift
    }

    // Slightly slower on position than on target: the world settles after the
    // camera does, which is what stops route changes feeling like a hard cut.
    camera.position.lerp(_pos, 1 - Math.exp(-2.4 * dt))
    look.current.lerp(_target, 1 - Math.exp(-3.2 * dt))
    camera.lookAt(look.current)

    if (Math.abs(camera.fov - shot.fov) > 0.01) {
      camera.fov = THREE.MathUtils.damp(camera.fov, shot.fov, 2.4, dt)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
