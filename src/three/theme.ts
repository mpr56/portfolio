import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useScene } from '../store'
import { PALETTE } from '../data/scene'

/**
 * Shared 0..1 day→night mix, mutated once per frame by <ThemeDriver /> and read
 * by every themed material. A module-level object rather than context so props
 * can sample it inside useFrame without re-rendering React on every step.
 */
export const themeMix = { value: 0 }

const _a = new THREE.Color()
const _b = new THREE.Color()

/** Lerp a palette colour into `out` at the current day/night mix. */
export function mixColor(out: THREE.Color, key: keyof typeof PALETTE.day) {
  _a.copy(PALETTE.day[key] as THREE.Color)
  _b.copy(PALETTE.night[key] as THREE.Color)
  return out.copy(_a).lerp(_b, themeMix.value)
}

/** Lerp a numeric palette value at the current day/night mix. */
export function mixNumber(key: keyof typeof PALETTE.day) {
  const a = PALETTE.day[key] as number
  const b = PALETTE.night[key] as number
  return a + (b - a) * themeMix.value
}

/**
 * Opening sequence state, sampled the same way as themeMix.
 *
 * `lights` never starts at zero: the room should read as a dim room before the
 * lights come up, not as a black screen someone is waiting on.
 */
const DIM = 0.03

export const intro = { t: -1, lights: DIM, screen: 0 }

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3

/**
 * The monitor's power-on: dead, a couple of quick flickers as the backlight
 * strikes, then a steady ramp. The flicker is what makes it read as a screen
 * turning on rather than a light fading up.
 */
function screenPower(t: number) {
  if (t < 0.72) return 0
  if (t < 0.92) return Math.sin((t - 0.72) * 72) > 0 ? 0.9 : 0.06
  return Math.min(1, (t - 0.92) / 0.4)
}

/**
 * Advances the day/night mix and the opening sequence. Rendered as the first
 * child of the scene so its useFrame subscription runs before the props that
 * sample these values.
 */
export function ThemeDriver() {
  const dark = useScene((s) => s.dark)
  const entered = useScene((s) => s.entered)

  useFrame((_, dt) => {
    themeMix.value = THREE.MathUtils.damp(themeMix.value, dark ? 1 : 0, 3.2, dt)

    if (!entered) return
    // Clamped so a long session doesn't accumulate a huge t.
    intro.t = intro.t < 0 ? 0 : Math.min(intro.t + dt, 8)
    // Ramps from DIM, not from a second hardcoded floor — otherwise the value
    // the scene sits at before the lights come up and the value the ramp starts
    // from disagree, and the opening jumps on its first frame.
    const ramp = THREE.MathUtils.clamp((intro.t - 0.55) / 1.45, 0, 1)
    intro.lights = DIM + (1 - DIM) * easeOutCubic(ramp)
    intro.screen = screenPower(intro.t)
  })
  return null
}
