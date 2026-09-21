import { create } from 'zustand'

/**
 * Per-device render quality, split in two along what can and cannot change
 * after the first frame.
 *
 * The split is not an optimisation, it is a correctness constraint. Changing
 * how many lights a scene has, or a light's castShadow flag, makes three
 * recompile every material in it — measured at 36 programs, seconds of stall
 * on a desktop and far worse on a phone. Changing a shadow map's size
 * reallocates the map; changing the composer's multisampling rebuilds its
 * render targets. Everything in that category is decided once, at boot, and
 * frozen. Everything else lives in an ordered array a runtime ratchet walks
 * downward.
 *
 * The governing principle for the boot heuristic falls out of that:
 * conservative on the static half, optimistic on the dynamic half. Only the
 * dynamic half can be corrected later — and the static half is the half
 * nobody can see.
 */

export type Tier = 'high' | 'medium' | 'low'

/** Decided once at boot. See the note above for why each entry is frozen. */
export type StaticQuality = {
  /** Composer MSAA samples. 0 means no MSAA; see `smaa`. */
  multisampling: number
  /** Cheap post-process AA, used where MSAA is off. */
  smaa: boolean
  /** Directional key light's shadow map edge, in px. */
  keyShadowMap: number
  /** Lamp spotlight's shadow map edge, in px. */
  lampShadowMap: number
  /** Point lights washing the wall behind the sign. */
  signLamps: number
}

/** Safe to change at any time: no shader variants, no reallocation. */
export type DynamicQuality = {
  dpr: number
  /**
   * Resolution scale of the bloom's luminance pass.
   *
   * NOT the Bloom component's `resolutionScale`, which is dead under
   * `mipmapBlur` — BloomEffect.setSize passes the full size to both the
   * luminance pass and the mipmap chain, so its own Resolution never reaches
   * anything that renders. The luminance pass carries its own Resolution with
   * a live `scale` setter, and its output is what feeds the mipmap chain. It
   * is the one full-resolution pass in the bloom, so it is also the one worth
   * scaling. 1 is what the scene has always run at.
   */
  luminanceScale: number
  idleFps: number
  activeFps: number
  /** Whether the plant, bass and sonycam take part in the shadow passes. */
  heavyShadowCasters: boolean
}

export const STATIC_QUALITY: Record<Tier, StaticQuality> = {
  // 2x MSAA rather than SMAA: the wall sign is extruded Text3D with sub-pixel
  // bevels, and SMAA handles thin geometry worse than real multisampling. 2x
  // is still a quarter of the 8x the composer defaulted to.
  high: { multisampling: 2, smaa: false, keyShadowMap: 2048, lampShadowMap: 1024, signLamps: 3 },
  medium: { multisampling: 0, smaa: true, keyShadowMap: 1024, lampShadowMap: 512, signLamps: 3 },
  low: { multisampling: 0, smaa: false, keyShadowMap: 1024, lampShadowMap: 512, signLamps: 1 },
}

/**
 * The ladder the runtime ratchet walks. Index 0 is the top; the ratchet only
 * ever increments, so it cannot oscillate and its whole state is one integer.
 *
 * A device that boots high and demotes twice ends up here at index 2 while
 * keeping high's static profile — 2x MSAA, a 2048 key shadow map, three sign
 * lamps. That is intended, not a bug to fix: the static half is frozen by the
 * constraints above, and it is also the half with the least to gain.
 */
export const DYNAMIC_QUALITY: DynamicQuality[] = [
  { dpr: 1.5, luminanceScale: 1, idleFps: 30, activeFps: 60, heavyShadowCasters: true },
  { dpr: 1.25, luminanceScale: 0.75, idleFps: 30, activeFps: 60, heavyShadowCasters: false },
  { dpr: 1, luminanceScale: 0.5, idleFps: 24, activeFps: 40, heavyShadowCasters: false },
]

const TIER_INDEX: Record<Tier, number> = { high: 0, medium: 1, low: 2 }
const TIER_ORDER: Tier[] = ['high', 'medium', 'low']

/** What the boot heuristic is allowed to look at. Passed in, so it is testable. */
export type BootEnv = {
  coarsePointer: boolean
  cores: number
  /** GB. Safari does not implement `navigator.deviceMemory` — undefined there. */
  memory: number | undefined
  /** Screen area in CSS pixels. */
  screenArea: number
}

/**
 * Native pixels a full-screen canvas would cover at a tier's DPR ceiling,
 * above which that tier is one step too ambitious.
 *
 * Screen size on its own says nothing — it is the pixel count that costs, and
 * the DPR ceiling is half of that product. So the two are judged together
 * rather than as separate rules. 6M sits comfortably above a 14" MacBook Pro
 * at 1.5x (~3.3M) and comfortably below a 6K panel at the same ceiling.
 */
const PIXEL_BUDGET = 6_000_000

/** Below this, the machine is old enough that MSAA and a 2048 map are a tax. */
const MIN_CORES_HIGH = 8
const MIN_CORES_MEDIUM = 6
const MIN_MEMORY_GB = 6

export function pickTier(env: BootEnv): Tier {
  // Touch devices go straight to low. Not a judgement about the silicon —
  // an iPad's GPU is quick — but the static half cannot be walked back, and a
  // phone that boots into 2x MSAA and a 2048 shadow map is stuck with them.
  if (env.coarsePointer) return 'low'

  let tier: Tier =
    env.cores >= MIN_CORES_HIGH
      ? 'high'
      : env.cores >= MIN_CORES_MEDIUM
        ? 'medium'
        : 'low'

  // Absent is unknown, not low: Safari never reports it, and every Mac would
  // otherwise be treated as a budget machine.
  if (env.memory !== undefined && env.memory < MIN_MEMORY_GB) tier = 'low'

  // Big panels pay for their pixels even on fast hardware.
  const index = TIER_INDEX[tier]
  const native = env.screenArea * DYNAMIC_QUALITY[index].dpr ** 2
  if (native > PIXEL_BUDGET) {
    return TIER_ORDER[Math.min(index + 1, TIER_ORDER.length - 1)]
  }
  return tier
}

/** Reads the real environment. Safe to call with no DOM — returns neutral values. */
export function readBootEnv(): BootEnv {
  if (typeof window === 'undefined') {
    return { coarsePointer: false, cores: 8, memory: undefined, screenArea: 1_500_000 }
  }
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    cores: nav.hardwareConcurrency || 4,
    memory: nav.deviceMemory,
    screenArea: (window.screen?.width ?? 1440) * (window.screen?.height ?? 900),
  }
}

/**
 * Decides the tier once, and publishes it to CSS as `<html data-tier>` so the
 * stylesheet can make the same call about, say, how expensive a backdrop blur
 * is allowed to be.
 *
 * `?tier=low` forces the choice. Not gated to DEV, unlike the other handles in
 * this codebase: a tier is a rendering preference, not a debug hook, and being
 * able to open the deployed site at a given tier is how the three get compared
 * on hardware none of us has.
 */
export function bootQuality(): { tier: Tier; index: number } {
  let tier = pickTier(readBootEnv())

  if (typeof window !== 'undefined') {
    const forced = new URLSearchParams(window.location.search).get('tier')
    if (forced === 'high' || forced === 'medium' || forced === 'low') tier = forced
    document.documentElement.dataset.tier = tier
  }

  return { tier, index: TIER_INDEX[tier] }
}

type QualityState = {
  tier: Tier
  fixed: StaticQuality
  /** Position in DYNAMIC_QUALITY. Only ever increases. */
  index: number
  dynamic: DynamicQuality
  /** Step one rung down the ladder. Idempotent at the bottom. */
  demote: () => void
}

export const useQuality = create<QualityState>((set, get) => {
  const { tier, index } = bootQuality()
  return {
    tier,
    fixed: STATIC_QUALITY[tier],
    index,
    dynamic: DYNAMIC_QUALITY[index],
    demote: () => {
      const next = Math.min(get().index + 1, DYNAMIC_QUALITY.length - 1)
      if (next === get().index) return
      set({ index: next, dynamic: DYNAMIC_QUALITY[next] })
    },
  }
})

/**
 * Whether the scene is moving in a way a visitor would notice a low frame rate
 * in. Read by the frame driver to pick an fps target, and by the key light to
 * decide whether its shadow map needs a fresh draw.
 *
 * Two mechanisms, because there are two kinds of motion. `poke` covers things
 * that settle — a hover lift damping out, the day/night dissolve, a route's
 * camera ease. `hold` covers things that run until told to stop — a record
 * spinning, an engine idling.
 *
 * Deliberately not part of useScene: this is sampled inside useFrame, and
 * nothing here may cause a React render.
 */
export const activity = { until: 0, held: 0 }

/** Tail after a discrete input, long enough for a hover lift to settle. */
export const TAIL_INPUT = 900
/** Tail after a transition: the theme dissolve and the route camera ease both
 *  damp over roughly a second and a half. */
export const TAIL_TRANSITION = 1800

export function poke(ms: number = TAIL_INPUT) {
  const until = performance.now() + ms
  if (until > activity.until) activity.until = until
}

/** Marks continuous motion. Call the returned function to release it. */
export function hold() {
  activity.held++
  let released = false
  return () => {
    if (released) return
    released = true
    activity.held--
  }
}

export function isMoving(now: number = performance.now()) {
  return activity.held > 0 || now < activity.until
}

// Dev handle, on the same terms as window.__scene in src/store.ts.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __quality: typeof useQuality }).__quality = useQuality
}
