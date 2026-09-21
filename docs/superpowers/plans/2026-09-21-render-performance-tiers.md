# Tiered Render Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the scene's steady-state CPU/GPU cost by roughly an order of magnitude without removing a single visual effect, by capping the frame loop, budgeting the shadow passes, and picking a quality profile per device.

**Architecture:** A new `src/quality.ts` owns two profiles — a *static* half chosen once at boot (MSAA, shadow-map sizes, sign-lamp count: all things that recompile shaders or reallocate targets if changed) and a *dynamic* half held in an ordered array that a one-way runtime ratchet may step down (DPR, bloom luminance scale, fps targets, heavy shadow casters). The `<Canvas>` moves to `frameloop="never"`, and a new `FrameDriver` component owns the only `requestAnimationFrame` loop, calling `advance()` on an fps budget and wall-clocking each call to feed the ratchet. The key light's shadow map stops redrawing every frame and refreshes on a budget instead.

**Tech Stack:** React 19, @react-three/fiber 9.7, @react-three/drei 10.7, @react-three/postprocessing 3.1 (postprocessing 6.x), three 0.185, zustand 5, TypeScript 7, Vite 8, Playwright 1.62. Vitest is added by Task 1.

**Spec:** [docs/superpowers/specs/2026-09-21-render-performance-tiers-design.md](../specs/2026-09-21-render-performance-tiers-design.md)

---

## Deviations from the spec

Three. The first two are corrections — the spec named levers that do not exist in the installed libraries. Read these before starting; they change what several tasks build.

**1. `bloomScale` does nothing. It becomes `luminanceScale`.**

The spec's dynamic profile has a `bloomScale` mapped to the `<Bloom>` component's `resolutionScale`. That prop sets `BloomEffect.resolution`, and with `mipmapBlur` enabled — which this scene uses (`Experience.tsx:60`) — `BloomEffect.resolution` is dead. From `postprocessing/build/index.js`:

```js
setSize(width, height) {
  const resolution = this.resolution;
  resolution.setBaseSize(width, height);
  this.renderTarget.setSize(resolution.width, resolution.height);  // unused under mipmapBlur
  this.blurPass.resolution.copy(resolution);                        // unused under mipmapBlur
  this.luminancePass.setSize(width, height);                        // FULL size
  this.mipmapBlurPass.setSize(width, height);                       // FULL size
}
```

`resolutionScale` is also marked `@deprecated. Use mipmapBlur instead.` in the constructor docs. So the spec's 8→0.5 bloom lever would have been a no-op that we'd have reported as a saving.

The lever that does work is `BloomEffect.luminancePass.resolution.scale`. `LuminancePass` carries its own `Resolution` with a live `scale` setter, and `BloomEffect.update()` feeds the luminance pass's target straight into the mipmap chain:

```js
luminancePass.render(renderer, inputBuffer);
this.mipmapBlurPass.render(renderer, luminancePass.renderTarget);
```

The luminance pass is the one full-resolution pass in the bloom, roughly 60% of its cost. Scaling it is a real saving, it is settable at runtime with no rebuild, and it keeps `mipmapBlur` — so the bloom stays the same *kind* of bloom, which is the spec's core constraint.

Because the luminance pass currently runs at full resolution, "no change from today" is `1.0`, not `0.5`. The tier values shift accordingly: **1.0 / 0.75 / 0.5** rather than 0.5 / 0.5 / 0.35. High tier is therefore bit-identical to today's bloom.

**2. `advance()` takes seconds, not milliseconds.**

Under `frameloop="never"`, R3F does not derive the frame delta from its clock. From `@react-three/fiber/dist/events-b1bdeb1a.cjs.dev.js`:

```js
let delta = state.clock.getDelta();
if (state.frameloop === 'never' && typeof timestamp === 'number') {
  delta = timestamp - state.clock.elapsedTime;
  state.clock.oldTime = state.clock.elapsedTime;
  state.clock.elapsedTime = timestamp;
}
```

Passing `performance.now()` would hand every `useFrame` a delta in the thousands and set `clock.elapsedTime` to milliseconds. `Plant.tsx:13` reads `state.clock.elapsedTime` directly, so its sway would run 1000× fast; every `MathUtils.damp` in the codebase would snap instantly. The driver must pass **seconds since the driver started**, which also keeps the first frame's delta near zero instead of handing the scene a multi-second jump.

**3. `window.screen` is used, `deviceMemory` more narrowly than implied.**

The spec lists four boot-heuristic inputs. Screen size is used as a pixel-budget backstop (Task 1, `PIXEL_BUDGET`) rather than as a tier input in its own right, because what a big screen actually costs is pixels, and pixels are what the DPR ceiling already bounds — the two have to be judged together or not at all.

## Global Constraints

Copied from the spec. Every task's requirements implicitly include these.

- **Light topology is frozen.** Never change how many lights the scene has, nor any light's `castShadow` flag, after mount. three recompiles every material when either moves — measured at 36 programs, seconds of stall on desktop and 20-30s on a phone. Mesh-level `castShadow` is *not* affected by this and is safe to change at runtime.
- **Shadow-map size is frozen after mount.** Changing `mapSize` reallocates the map.
- **Composer multisampling is frozen after mount.** Changing it rebuilds the composer's render targets.
- **No effect may be removed.** Bloom, vignette, the lamp, both shadow-casting lights and the wall sign all survive. This work changes the rate and resolution at which they are paid for, nothing else.
- **`npm run models` is unavailable.** `internet3dmodels/` is not in the working tree. Nothing here may require regenerating a GLB.
- **`frameloop="never"` means the driver is the only thing that renders.** Any code path that assumed a frame would happen on its own must now be reachable from the driver's budget.
- **Verification command:** `npm run typecheck` must pass at the end of every task. `npm test` must pass for every task that adds or touches a test.
- **Dev handles:** `window.__scene` (store), `window.__three` (scene/gl/camera) already exist and are DEV-only. Task 1 adds `window.__quality` on the same terms.

---

### Task 1: Quality profiles and the boot heuristic

The whole design hangs off this module. It is pure except for one `bootQuality()` function, which is what makes the heuristic testable without a DOM.

**Files:**
- Create: `src/quality.ts`
- Create: `src/quality.test.ts`
- Modify: `package.json` (add `vitest`, add a `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Tier = 'high' | 'medium' | 'low'`
  - `type StaticQuality = { multisampling: number; smaa: boolean; keyShadowMap: number; lampShadowMap: number; signLamps: number }`
  - `type DynamicQuality = { dpr: number; luminanceScale: number; idleFps: number; activeFps: number; heavyShadowCasters: boolean }`
  - `type BootEnv = { coarsePointer: boolean; cores: number; memory: number | undefined; screenArea: number }`
  - `STATIC_QUALITY: Record<Tier, StaticQuality>`
  - `DYNAMIC_QUALITY: DynamicQuality[]` (index 0 = high, 1 = medium, 2 = low)
  - `pickTier(env: BootEnv): Tier`
  - `readBootEnv(): BootEnv`
  - `bootQuality(): { tier: Tier; index: number }`
  - `useQuality` — zustand store, state `{ tier: Tier; fixed: StaticQuality; index: number; dynamic: DynamicQuality; demote: () => void }`
  - `activity: { until: number; held: number }`, `poke(ms?: number): void`, `hold(): () => void`, `isMoving(now?: number): boolean`
  - `TAIL_INPUT = 900`, `TAIL_TRANSITION = 1800`

- [ ] **Step 1: Install vitest and add the test script**

```bash
npm install --save-dev vitest
```

Then edit `package.json` so the `scripts` block reads:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "models": "node scripts/optimize.mjs",
    "inspect": "node scripts/inspect.mjs",
    "perf": "node scripts/perf.mjs"
  },
```

(`perf` is wired up in Task 2; adding it here avoids a second edit to the same block.)

No `vitest.config.ts` is needed. Vitest reads `vite.config.ts`, and every test in this plan runs in the default `node` environment — `src/quality.ts` is written so importing it never requires a DOM.

- [ ] **Step 2: Write the failing tests**

Create `src/quality.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  DYNAMIC_QUALITY,
  STATIC_QUALITY,
  pickTier,
  type BootEnv,
} from './quality'

/** A fast, modern desktop: fine pointer, plenty of cores, ordinary screen. */
const desktop: BootEnv = {
  coarsePointer: false,
  cores: 12,
  memory: undefined, // Safari reports nothing, which must not read as "low"
  screenArea: 1512 * 982,
}

describe('pickTier', () => {
  it('gives a modern laptop the high tier', () => {
    expect(pickTier(desktop)).toBe('high')
  })

  it('treats a missing deviceMemory as unknown, not as low', () => {
    expect(pickTier({ ...desktop, memory: undefined })).toBe(
      pickTier({ ...desktop, memory: 16 }),
    )
  })

  it('puts every touch device on low, however many cores it reports', () => {
    expect(pickTier({ ...desktop, coarsePointer: true, cores: 16 })).toBe('low')
  })

  it('puts a four-core machine on low', () => {
    expect(pickTier({ ...desktop, cores: 4 })).toBe('low')
  })

  it('puts a six-core machine on medium', () => {
    expect(pickTier({ ...desktop, cores: 6 })).toBe('medium')
  })

  it('puts a memory-starved machine on low', () => {
    expect(pickTier({ ...desktop, memory: 4 })).toBe('low')
  })

  it('steps a big-panel desktop down one tier on the pixel budget', () => {
    // A 6K panel reports ~3008x1692 CSS px. At high's 1.5 DPR ceiling that is
    // ~11.5M native pixels, past the budget, so it must not boot on high.
    expect(pickTier({ ...desktop, screenArea: 3008 * 1692 })).toBe('medium')
  })

  it('never steps below low on the pixel budget', () => {
    expect(
      pickTier({ ...desktop, cores: 2, screenArea: 3008 * 1692 }),
    ).toBe('low')
  })
})

describe('profiles', () => {
  it('orders the dynamic profiles cheapest-last', () => {
    for (let i = 1; i < DYNAMIC_QUALITY.length; i++) {
      expect(DYNAMIC_QUALITY[i].dpr).toBeLessThanOrEqual(DYNAMIC_QUALITY[i - 1].dpr)
      expect(DYNAMIC_QUALITY[i].luminanceScale).toBeLessThanOrEqual(
        DYNAMIC_QUALITY[i - 1].luminanceScale,
      )
      expect(DYNAMIC_QUALITY[i].activeFps).toBeLessThanOrEqual(
        DYNAMIC_QUALITY[i - 1].activeFps,
      )
    }
  })

  it('leaves the high tier bloom untouched at full resolution', () => {
    expect(DYNAMIC_QUALITY[0].luminanceScale).toBe(1)
  })

  it('keeps at least one sign lamp at every tier', () => {
    // Zero lamps would leave the wall sign unlit, which is an effect removed.
    for (const tier of Object.values(STATIC_QUALITY)) {
      expect(tier.signLamps).toBeGreaterThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./quality"`.

- [ ] **Step 4: Write `src/quality.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 11 tests.

If `pickTier(desktop)` returns `medium`, check `PIXEL_BUDGET`: `1512 * 982 * 1.5**2` is 3.34M and must be under it.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean. `import.meta.env.DEV` is already typed via `"types": ["vite/client"]` in `tsconfig.json`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/quality.ts src/quality.test.ts
git commit -m "Quality tiers: profiles, boot heuristic, activity signal

Splits render quality into a static half frozen at boot (MSAA, shadow map
sizes, sign lamps — all things that recompile shaders or reallocate targets
if changed) and a dynamic half a runtime ratchet can step down.

Adds vitest, which the repo had no equivalent of, to cover the boot
heuristic: it is pure and takes its environment as an argument precisely so
it can be tested without a browser.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The measurement harness, and a baseline off `main`

Built before the optimisations, not after, so the before/after table is measured rather than argued. The spec is explicit that no performance claim goes in the PR without this script's output.

**Files:**
- Create: `scripts/perf.mjs`
- Create: `shots/.gitignore` — only if `shots/` is not already ignored; check first.

**Interfaces:**
- Consumes: `?tier=` from Task 1 (optional — the script degrades to whatever tier the heuristic picks when the param is unsupported, which is the case on `main`).
- Produces: a CLI. `node scripts/perf.mjs [url] [--tier=high|medium|low] [--route=/] [--label=name] [--json=path]`.

- [ ] **Step 1: Write the harness**

Create `scripts/perf.mjs`:

```js
/**
 * Measures what a frame actually costs, so the tier work can be judged instead
 * of estimated.
 *
 *   node scripts/perf.mjs [url] [--tier=high] [--route=/] [--label=before]
 *                         [--json=perf/before.json] [--seconds=10]
 *
 * Two samples per run: ten seconds sitting idle, then ten seconds with the
 * pointer moving, because the whole design turns on those being different.
 *
 * Follows scripts/shot.mjs: same browser flags, same wait for the loading
 * curtain, same use of the dev handles rather than faked clicks.
 *
 * Numbers are indicative, not absolute. A headless Chromium on a busy laptop
 * is not a visitor's machine — what this is for is comparing two builds under
 * identical conditions, which is exactly what the before/after table needs.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

const base = positional[0] ?? 'http://localhost:5180'
const tier = flag('tier')
const route = flag('route') ?? '/'
const label = flag('label') ?? tier ?? 'default'
const json = flag('json')
const seconds = Number(flag('seconds') ?? 10)

const url = new URL(route, base)
if (tier) url.searchParams.set('tier', tier)

const browser = await chromium.launch({
  args: [
    '--use-angle=metal',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ],
})

const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
})

const logs = []
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60_000 })

// The curtain lifts by itself once every model has decoded.
try {
  await page.waitForFunction(
    () => document.querySelector('.intro')?.classList.contains('is-gone') ?? true,
    { timeout: 60_000 },
  )
} catch {
  logs.push('[warn] never got past the loading curtain')
}

// Let the opening sequence finish and the damped values settle, so none of the
// intro's own work lands in the idle sample.
await page.waitForTimeout(4000)

// __three is DEV-only (Experience.tsx:92), so this has to run against `npm run
// dev`, not a preview build. Say so plainly rather than failing on undefined.
const hasHandle = await page.evaluate(() => Boolean(window.__three))
if (!hasHandle) {
  await browser.close()
  console.error('window.__three is missing — run this against `npm run dev`, not a preview build.')
  process.exit(1)
}

/**
 * Counts frames and draw calls over a window.
 *
 * Draw calls come from a monkey-patched `render`, not from reading
 * `gl.info.render` at the end: the composer runs several fullscreen passes per
 * frame and three resets those counters on every render() call, so a reading
 * taken afterwards describes the last bloom quad. XRay.tsx:74-81 hit exactly
 * this and documents it.
 */
async function sample(ms, movePointer = false) {
  await page.evaluate((movePointer) => {
    const { gl } = window.__three
    const w = (window.__perf = { frames: 0, calls: 0, tris: 0, deltas: [], last: 0 })
    const render = gl.render.bind(gl)
    w.restore = () => {
      gl.render = render
      cancelAnimationFrame(w.raf)
    }
    gl.render = (scene, camera) => {
      render(scene, camera)
      w.calls += gl.info.render.calls
      w.tris += gl.info.render.triangles
    }
    const canvas = gl.domElement
    const tick = (t) => {
      w.raf = requestAnimationFrame(tick)
      if (w.last) w.deltas.push(t - w.last)
      w.last = t
      w.frames++
      if (!movePointer) return
      // Dispatched in-page rather than driven by page.mouse.move: Playwright
      // serialises operations on a page, so an outer mouse loop would contend
      // with the evaluate calls that start and stop this sample.
      const x = 700 + Math.sin(w.frames / 8) * 300
      const y = 500 + Math.cos(w.frames / 11) * 180
      const event = new PointerEvent('pointermove', {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerType: 'mouse',
      })
      canvas.dispatchEvent(event)
    }
    w.raf = requestAnimationFrame(tick)
  }, movePointer)

  await page.waitForTimeout(ms)

  return page.evaluate((ms) => {
    const w = window.__perf
    w.restore()
    // rAF ticks at the display rate whatever the scene does, so frames-per-
    // second here is the browser's rate, not the scene's. The scene's rate is
    // draw activity: count distinct render() bursts instead.
    const sorted = [...w.deltas].sort((a, b) => a - b)
    return {
      seconds: ms / 1000,
      rafFps: +(w.frames / (ms / 1000)).toFixed(1),
      medianRafDelta: +(sorted[sorted.length >> 1] ?? 0).toFixed(2),
      drawCalls: w.calls,
      triangles: w.tris,
      drawCallsPerSecond: +(w.calls / (ms / 1000)).toFixed(0),
      trianglesPerSecond: +(w.tris / (ms / 1000)).toFixed(0),
    }
  }, ms)
}

const idle = await sample(seconds * 1000)

// Synthetic pointer movement: the active path, and the one a visitor spends
// most of their time in.
const active = await sample(seconds * 1000, true)

const report = {
  label,
  url: url.toString(),
  tier: await page.evaluate(() => document.documentElement.dataset.tier ?? null),
  dpr: await page.evaluate(() => window.__three?.gl.getPixelRatio() ?? null),
  idle,
  active,
}

await browser.close()

const row = (name, s) =>
  `  ${name.padEnd(8)} ${String(s.drawCallsPerSecond).padStart(9)} ${String(
    s.trianglesPerSecond,
  ).padStart(13)} ${String(s.medianRafDelta).padStart(9)}`

console.log(`\n${report.label} — tier ${report.tier ?? '?'}, dpr ${report.dpr ?? '?'}`)
console.log('           calls/sec  triangles/sec  rAF ms')
console.log(row('idle', idle))
console.log(row('active', active))

if (json) {
  mkdirSync(dirname(json), { recursive: true })
  writeFileSync(json, JSON.stringify(report, null, 2))
  console.log(`\nwrote ${json}`)
}

if (logs.length) {
  console.log('\nconsole:')
  for (const l of [...new Set(logs)].slice(0, 25)) console.log('  ' + l)
} else {
  console.log('\nconsole: clean')
}
```

- [ ] **Step 2: Check `perf/` will not be committed**

Run: `git check-ignore -v perf/before.json; cat .gitignore`

If `perf/` is not covered, append `perf/` to `.gitignore`. The JSON reports are machine-local measurements, not artefacts.

- [ ] **Step 3: Capture the baseline off `main`**

The baseline has to come from `main`, not from the branch, and `scripts/perf.mjs` does not exist on `main` — so run the script from the branch against a dev server serving `main`. A worktree is what gives you both at once.

```bash
git worktree add /tmp/portfolio-main main
(cd /tmp/portfolio-main && npm ci && npm run dev -- --port 5180) &
```

Wait for the server, then from the repo root:

```bash
node scripts/perf.mjs http://localhost:5180 --label=before --json=perf/before.json
```

Stop the dev server and remove the worktree:

```bash
git worktree remove /tmp/portfolio-main --force
```

Expected: a table with non-zero `calls/sec` on both rows, and `idle` and `active` roughly equal — on `main` there is no distinction between them, which is the entire problem.

Record the numbers in the commit message. If Playwright cannot get a GPU in this environment and every number comes back zero or the console shows WebGL errors, say so and stop: the rest of the plan is still correct, but the verification step in Task 10 will have to be run by hand on a real machine.

- [ ] **Step 4: Commit**

```bash
git add scripts/perf.mjs package.json .gitignore
git commit -m "Frame-cost harness

Measures draw calls and triangles per second, idle and under synthetic
pointer movement, so the tier work gets a before/after table instead of an
argument. Patches gl.render rather than reading gl.info afterwards — the
composer's fullscreen passes reset those counters, which is the trap
XRay.tsx already documents.

Baseline off main: <paste the table here>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The frame budget

Pure logic, split out of the driver so it can be tested without a browser. The driver in Task 4 is then a thin shell around it.

**Files:**
- Create: `src/three/frameBudget.ts`
- Create: `src/three/frameBudget.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class FrameBudget` with `sample(now: number, cost: number, targetFps: number): boolean` — returns `true` exactly once when the profile should step down. Also exported for the tests: `WARMUP_MS`, `WINDOW_MS`, `THRESHOLD`, `STRIKES`, `MIN_SAMPLES`.

- [ ] **Step 1: Write the failing tests**

Create `src/three/frameBudget.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { FrameBudget, MIN_SAMPLES, STRIKES, WARMUP_MS, WINDOW_MS } from './frameBudget'

const TARGET = 60
const BUDGET = 1000 / TARGET // 16.67ms
const CHEAP = 2
const EXPENSIVE = 15 // well past 70% of 16.67

/** Feeds one window's worth of frames at a fixed cost, starting at `from`. */
function feedWindow(budget: FrameBudget, from: number, cost: number) {
  let demoted = false
  const step = WINDOW_MS / MIN_SAMPLES
  // One extra sample past the window's end, which is what closes it.
  for (let i = 0; i <= MIN_SAMPLES; i++) {
    if (budget.sample(from + i * step, cost, TARGET)) demoted = true
  }
  return { demoted, end: from + MIN_SAMPLES * step }
}

describe('FrameBudget', () => {
  let budget: FrameBudget

  beforeEach(() => {
    budget = new FrameBudget()
    // Anchor the warmup clock at zero. The budget starts its warmup on the
    // first frame it is ever shown, so without this every helper below would
    // hand it its first frame at WARMUP_MS and lose another whole warmup to it.
    budget.sample(0, 0, TARGET)
  })

  it('ignores everything during warmup', () => {
    // Shader compiles and texture uploads are not steady-state cost.
    let demoted = false
    for (let t = 0; t < WARMUP_MS; t += 16) {
      if (budget.sample(t, 999, TARGET)) demoted = true
    }
    expect(demoted).toBe(false)
  })

  it('does not demote on cheap frames', () => {
    let t = WARMUP_MS
    for (let w = 0; w < 6; w++) {
      const r = feedWindow(budget, t, CHEAP)
      expect(r.demoted).toBe(false)
      t = r.end
    }
  })

  it('demotes only after consecutive expensive windows', () => {
    let t = WARMUP_MS
    const results = []
    for (let w = 0; w < STRIKES; w++) {
      const r = feedWindow(budget, t, EXPENSIVE)
      results.push(r.demoted)
      t = r.end
    }
    // Every window but the last must be a warning, not a demotion.
    expect(results.slice(0, -1).every((d) => d === false)).toBe(true)
    expect(results.at(-1)).toBe(true)
  })

  it('forgives a bad window followed by a good one', () => {
    let t = WARMUP_MS
    t = feedWindow(budget, t, EXPENSIVE).end
    t = feedWindow(budget, t, CHEAP).end
    // The strike count reset, so one more bad window must not be enough.
    expect(feedWindow(budget, t, EXPENSIVE).demoted).toBe(false)
  })

  it('discards a window too sparse to judge', () => {
    // A handful of expensive frames scattered across a long window says
    // nothing about sustained cost.
    let t = WARMUP_MS
    let demoted = false
    for (let w = 0; w < 6; w++) {
      for (let i = 0; i < 3; i++) {
        if (budget.sample(t + (i * WINDOW_MS) / 3, EXPENSIVE, TARGET)) demoted = true
      }
      t += WINDOW_MS + 1
      if (budget.sample(t, EXPENSIVE, TARGET)) demoted = true
    }
    expect(demoted).toBe(false)
  })

  it('judges against the target it is given', () => {
    // 15ms is a failure against 60fps and a pass against 30fps.
    const slow = new FrameBudget()
    slow.sample(0, 0, 30)
    let t = WARMUP_MS
    let demoted = false
    for (let w = 0; w < STRIKES + 1; w++) {
      const step = WINDOW_MS / MIN_SAMPLES
      for (let i = 0; i <= MIN_SAMPLES; i++) {
        if (slow.sample(t + i * step, EXPENSIVE, 30)) demoted = true
      }
      t += WINDOW_MS + 1
    }
    expect(demoted).toBe(false)
  })

  it('uses the median, so one stalled frame cannot demote a healthy device', () => {
    let t = WARMUP_MS
    let demoted = false
    const step = WINDOW_MS / MIN_SAMPLES
    for (let w = 0; w < STRIKES + 1; w++) {
      for (let i = 0; i <= MIN_SAMPLES; i++) {
        // One catastrophic frame per window; every other frame is cheap.
        const cost = i === 0 ? 4000 : CHEAP
        if (budget.sample(t + i * step, cost, TARGET)) demoted = true
      }
      t += WINDOW_MS + 1
    }
    expect(demoted).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./frameBudget"`.

- [ ] **Step 3: Write `src/three/frameBudget.ts`**

```ts
/**
 * Decides when the device is not keeping up.
 *
 * Drei's PerformanceMonitor cannot answer this once the loop is capped: it
 * derives its factor from observed frames per second against a pair of
 * bounds, so a deliberate 30fps idle cap reads to it as a struggling machine
 * and fires onDecline on hardware that is perfectly happy. What survives a cap
 * is frame *cost* — how long the work takes — which is independent of how
 * often it is asked for.
 *
 * Deliberately slow to fire. A demotion is visible and permanent for the
 * session, so the bar is a sustained median over consecutive windows, not a
 * spike.
 *
 * One honest limitation: wall-clocking the render call measures the time spent
 * submitting work, not the time the GPU spends doing it. The two correlate,
 * because a backed-up queue stalls the submitting thread, but they are not the
 * same number. scripts/perf.mjs is how we find out whether this fires when it
 * should.
 */

/** Frames ignored outright: the first seconds are shader compiles and uploads. */
export const WARMUP_MS = 4000
/** Length of one judgement window. */
export const WINDOW_MS = 2000
/** Fraction of the frame budget the median may reach before a window fails. */
export const THRESHOLD = 0.7
/** Failed windows in a row before the profile steps down. */
export const STRIKES = 2
/** A window thinner than this is discarded rather than judged. */
export const MIN_SAMPLES = 20

export class FrameBudget {
  private costs: number[] = []
  private windowStart = -1
  private strikes = 0
  private started = -1

  /**
   * @param now   ms, monotonic — whatever requestAnimationFrame handed over
   * @param cost  ms spent inside the render call
   * @param targetFps the budget this frame was rendered against
   * @returns true exactly once, on the frame that closes a failing streak
   */
  sample(now: number, cost: number, targetFps: number): boolean {
    if (this.started < 0) this.started = now
    if (now - this.started < WARMUP_MS) return false

    if (this.windowStart < 0) this.windowStart = now
    this.costs.push(cost)
    if (now - this.windowStart < WINDOW_MS) return false

    const samples = this.costs
    this.costs = []
    this.windowStart = now

    // Too few frames to say anything. Discarding rather than judging matters:
    // samples only arrive while the scene is active, so a window can easily
    // straddle a long idle stretch and hold three frames.
    if (samples.length < MIN_SAMPLES) {
      this.strikes = 0
      return false
    }

    samples.sort((a, b) => a - b)
    const median = samples[samples.length >> 1]

    if (median <= (1000 / targetFps) * THRESHOLD) {
      this.strikes = 0
      return false
    }

    this.strikes++
    if (this.strikes < STRIKES) return false
    this.strikes = 0
    return true
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 18 tests total.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/three/frameBudget.ts src/three/frameBudget.test.ts
git commit -m "Frame cost budget for the quality ratchet

Measures frame cost rather than frame rate, because a capped loop makes rate
meaningless — drei's PerformanceMonitor would read a deliberate 30fps idle as
a struggling device. Median over consecutive windows, so a single stalled
frame cannot demote healthy hardware.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The frame driver, and cutting the loop over to it

The driver and `frameloop="never"` must land in the same commit. Either alone leaves the scene broken — `frameloop="never"` with no driver is a frozen canvas, and a driver under `frameloop="always"` renders every frame twice.

**Files:**
- Create: `src/three/FrameDriver.tsx`
- Modify: `src/three/Experience.tsx` — lines 1-4 (imports), 70-79 (canvas props), 104-107 (PerformanceMonitor), 132 (AdaptiveDpr)

**Interfaces:**
- Consumes: `useQuality`, `isMoving`, `poke`, `hold`, `TAIL_INPUT`, `TAIL_TRANSITION` from `src/quality.ts`; `FrameBudget` from `src/three/frameBudget.ts`; `useScene` from `src/store.ts`.
- Produces: `<FrameDriver />`, a component rendering `null`, mounted inside `<Canvas>`.

- [ ] **Step 1: Write `src/three/FrameDriver.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useLocation } from 'react-router-dom'
import { FrameBudget } from './frameBudget'
import { intro } from './theme'
import { useScene } from '../store'
import { TAIL_INPUT, TAIL_TRANSITION, hold, isMoving, poke, useQuality } from '../quality'

/**
 * The only requestAnimationFrame loop in the app.
 *
 * The scene used to render at the display's refresh rate forever — 120fps on a
 * ProMotion Mac, for a room that is almost always perfectly still. Nothing here
 * changes what a frame contains; it changes how often one is asked for.
 *
 * frameloop="demand" would have been simpler and is not available: Plant.tsx
 * sways on a sine that never stops, and the damps in Rig.tsx and theme.ts are
 * asymptotic, so the scene is never exactly still and demand would render
 * every frame anyway.
 */

/**
 * While a route sheet is open, styles.css puts a 22px backdrop blur over the
 * canvas. The scene behind it is already past legibility, so it gets the
 * cheapest treatment in the app.
 */
const SHEET_FPS = 15
const SHEET_DPR = 0.75

/**
 * Slack on the frame-due test, in ms.
 *
 * Without it a 60fps target on a 60Hz display drops every other frame: rAF
 * deltas jitter either side of 16.67, and half of them land just under the
 * interval and get skipped, halving the rate.
 */
const SLACK = 2

/** How long the opening sequence is treated as active. theme.ts:71 ramps the
 *  lights over roughly two seconds and it is the first thing anyone sees. */
const INTRO_ACTIVE_UNTIL = 2.4

export function FrameDriver() {
  const advance = useThree((s) => s.advance)
  const setDpr = useThree((s) => s.setDpr)
  const demote = useQuality((s) => s.demote)
  const dynamic = useQuality((s) => s.dynamic)
  const { pathname } = useLocation()
  const playing = useScene((s) => s.playing)

  const sheet = pathname !== '/'

  // Read inside the loop rather than closed over, so changing either does not
  // tear down and restart the rAF loop.
  const profile = useRef(dynamic)
  profile.current = dynamic
  const sheetOpen = useRef(sheet)
  sheetOpen.current = sheet

  // A record spinning or an engine idling runs until stopped, so it is a hold
  // rather than a poke — a poke would expire halfway through the track.
  useEffect(() => {
    if (!playing) return
    return hold()
  }, [playing])

  // Any state the visitor can change is a transition worth smoothing: the
  // theme dissolve, the sign fading, x-ray coming on, the mobile scrubber.
  useEffect(
    () =>
      useScene.subscribe((state, previous) => {
        if (
          state.hovered !== previous.hovered ||
          state.dark !== previous.dark ||
          state.signOn !== previous.signOn ||
          state.xray !== previous.xray ||
          state.help !== previous.help ||
          state.pan !== previous.pan ||
          state.entered !== previous.entered
        ) {
          poke(state.dark !== previous.dark ? TAIL_TRANSITION : TAIL_INPUT)
        }
      }),
    [],
  )

  // A route change eases the camera across the room over about a second and a
  // half, and that is the most visible motion in the app.
  useEffect(() => {
    poke(TAIL_TRANSITION)
  }, [pathname])

  // Pointer movement drives the camera parallax in Rig.tsx, so it is motion
  // even when nothing is clicked. Passive and on the window: the canvas fills
  // the viewport and this must not interfere with the scene's own picking.
  useEffect(() => {
    const onInput = () => poke()
    const opts = { passive: true } as const
    window.addEventListener('pointermove', onInput, opts)
    window.addEventListener('pointerdown', onInput, opts)
    window.addEventListener('wheel', onInput, opts)
    window.addEventListener('keydown', onInput, opts)
    window.addEventListener('resize', onInput, opts)
    return () => {
      window.removeEventListener('pointermove', onInput)
      window.removeEventListener('pointerdown', onInput)
      window.removeEventListener('wheel', onInput)
      window.removeEventListener('keydown', onInput)
      window.removeEventListener('resize', onInput)
    }
  }, [])

  // The driver owns DPR outright. <Canvas dpr> is set once at mount and never
  // again, because a re-render of Canvas would overwrite whatever is set here.
  useEffect(() => {
    setDpr(sheet ? dynamic.dpr * SHEET_DPR : dynamic.dpr)
  }, [setDpr, sheet, dynamic.dpr])

  useEffect(() => {
    const budget = new FrameBudget()
    const start = performance.now()
    let raf = 0
    let last = -Infinity

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)

      const moving =
        isMoving(now) || (intro.t >= 0 && intro.t < INTRO_ACTIVE_UNTIL)
      const target = moving
        ? profile.current.activeFps
        : sheetOpen.current
          ? SHEET_FPS
          : profile.current.idleFps

      if (now - last < 1000 / target - SLACK) return
      last = now

      // Seconds, not milliseconds. Under frameloop="never" R3F sets
      // clock.elapsedTime to this value and derives every useFrame delta from
      // it, so passing performance.now() would run Plant.tsx's sway a thousand
      // times too fast and snap every damp in the scene on the first frame.
      // Relative to the driver's start, so frame one gets a delta near zero.
      const t0 = performance.now()
      advance((now - start) / 1000)
      const cost = performance.now() - t0

      // Only frames rendered against the active target are judged. Cost
      // measured against a 30fps idle budget says nothing useful, and mixing
      // the two targets inside one window would make the median meaningless.
      if (moving && budget.sample(now, cost, profile.current.activeFps)) demote()
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [advance, demote])

  return null
}
```

- [ ] **Step 2: Cut `Experience.tsx` over to the driver**

Replace lines 1-6 of `src/three/Experience.tsx`:

```tsx
import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { BloomEffect, VignetteEffect } from 'postprocessing'
```

with:

```tsx
import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { BloomEffect, VignetteEffect } from 'postprocessing'

import { FrameDriver } from './FrameDriver'
import { useQuality } from '../quality'
```

Replace lines 70-79 (from `export function Experience()` through the `gl={...}` line):

```tsx
export function Experience() {
  const setHovered = useScene((s) => s.setHovered)
  // Drop the pixel ratio ceiling if the GPU can't hold frame rate.
  const [dpr, setDpr] = useState(1.5)

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
```

with:

```tsx
export function Experience() {
  const setHovered = useScene((s) => s.setHovered)

  // Frozen at mount: <FrameDriver> owns the pixel ratio from here, and a live
  // dpr prop would overwrite whatever it set on the next render of <Canvas>.
  const [initialDpr] = useState(() => useQuality.getState().dynamic.dpr)

  return (
    <Canvas
      shadows
      frameloop="never"
      dpr={initialDpr}
      // No antialias: the composer renders to its own target, so MSAA on the
      // default framebuffer resolves nothing anybody sees. It has been paying
      // for a buffer the scene never draws into.
      gl={{ powerPreference: 'high-performance' }}
```

Delete lines 104-107 entirely:

```tsx
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
      />
```

and put the driver in their place, as the first child:

```tsx
      {/* Owns the only rAF loop. Must come before ThemeDriver so its DOM
          listeners are attached before the first frame is asked for. */}
      <FrameDriver />
```

Replace line 132, `      <AdaptiveDpr pixelated />`, with nothing — delete the line. Both drei helpers go: `PerformanceMonitor` misreads a capped loop as a struggling device, and the two were fighting each other over who owned DPR.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `useState` is reported unused, it is not — `initialDpr` still uses it.

- [ ] **Step 4: Verify the scene still runs, and runs at the right speed**

```bash
npm run dev -- --port 5180 &
node scripts/shot.mjs http://localhost:5180 shots/driver.png
```

Expected: `console: clean`, and `shots/driver.png` shows the lit room exactly as before.

This is the step where the seconds-vs-milliseconds bug in Deviation 2 would show. Check the screenshot for it specifically: if the timestamp were wrong, the intro ramp would have completed in one frame and the plant would be visibly rotated off vertical. Then confirm the rate directly:

```bash
node scripts/perf.mjs http://localhost:5180 --label=capped --seconds=6
```

Expected: `idle` shows markedly fewer calls/sec than `active` — the first time the two rows have differed. If they are equal, `isMoving` is stuck true; check that the `pointermove` listener is not being fed by the synthetic movement during the idle sample (it should not be — the idle sample runs first).

- [ ] **Step 5: Commit**

```bash
git add src/three/FrameDriver.tsx src/three/Experience.tsx
git commit -m "Cap the frame loop; one driver owns rAF

frameloop=never plus a single driver that calls advance() on a budget: 30fps
idle, 60 while anything is moving, 15 behind a route sheet. The scene was
rendering at the display's refresh rate forever for a room that is almost
always still.

Drops PerformanceMonitor and AdaptiveDpr. The first derives its factor from
observed fps, so a deliberate idle cap reads to it as a struggling device;
the two also fought over who owned DPR. Drops gl.antialias, which the
composer has always made dead weight.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Tier-driven antialiasing and bloom resolution

**Files:**
- Modify: `src/three/Experience.tsx` — the `Effects` component, lines 41-68

**Interfaces:**
- Consumes: `useQuality` (`fixed.multisampling`, `fixed.smaa`, `dynamic.luminanceScale`).
- Produces: nothing new.

- [ ] **Step 1: Add the SMAA import**

In `src/three/Experience.tsx`, change:

```tsx
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
```

to:

```tsx
import { EffectComposer, Bloom, SMAA, Vignette } from '@react-three/postprocessing'
```

The React import on line 1 does not change.

- [ ] **Step 2: Rewrite the `Effects` component**

Replace the whole of `function Effects()` (lines 41-68) with:

```tsx
function Effects() {
  const bloom = useRef<BloomEffect>(null)
  const vignette = useRef<VignetteEffect>(null)
  const fixed = useQuality((s) => s.fixed)
  const luminanceScale = useQuality((s) => s.dynamic.luminanceScale)

  useFrame(() => {
    const night = themeMix.value
    if (bloom.current) {
      bloom.current.intensity = mix(PALETTE.day.bloom, PALETTE.night.bloom, night)
      bloom.current.luminanceMaterial.threshold = mix(0.85, 0.62, night)

      /**
       * Scale the bloom's luminance pass, not the effect's own resolution.
       *
       * <Bloom resolutionScale> sets BloomEffect.resolution, and under
       * mipmapBlur — which this scene uses — that is dead: setSize hands the
       * full size to both the luminance pass and the mipmap chain and never
       * consults it. The luminance pass has its own Resolution, it is the one
       * full-resolution pass in the bloom, and its output is what feeds the
       * mipmap chain.
       *
       * Set here rather than in an effect because the composer sizes its
       * passes in an effect of its own, and a scale applied before the pass
       * has a base size would resize it to nothing. Guarded, so this is a
       * comparison per frame and an assignment only when the ratchet moves.
       */
      const resolution = bloom.current.luminancePass.resolution
      if (resolution.scale !== luminanceScale) resolution.scale = luminanceScale
    }
    if (vignette.current) {
      vignette.current.darkness = mix(PALETTE.day.vignette, PALETTE.night.vignette, night)
    }
  })

  return (
    /*
     * multisampling comes from the frozen half of the profile and never moves:
     * changing it rebuilds every render target the composer owns.
     *
     * The default was 8, on a half-float target at DPR 2 — eight samples per
     * pixel for a scene whose only thin geometry is one wall sign. High tier
     * keeps real MSAA at 2x because that sign is extruded Text3D with
     * sub-pixel bevels and SMAA handles thin geometry worse; everything below
     * high takes SMAA or nothing.
     */
    <EffectComposer enableNormalPass={false} multisampling={fixed.multisampling}>
      <Bloom
        ref={bloom}
        mipmapBlur
        intensity={PALETTE.day.bloom}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.22}
      />
      <Vignette ref={vignette} offset={0.28} darkness={PALETTE.day.vignette} eskil={false} />
      {/* Last, so it antialiases the graded image rather than the raw one. */}
      {fixed.smaa && <SMAA />}
    </EffectComposer>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Check all three tiers render**

```bash
node scripts/shot.mjs "http://localhost:5180/?tier=high" shots/tier-high.png
node scripts/shot.mjs "http://localhost:5180/?tier=medium" shots/tier-medium.png
node scripts/shot.mjs "http://localhost:5180/?tier=low" shots/tier-low.png
```

Expected: `console: clean` on all three, and three lit rooms.

Then look at the images, specifically for the failure the spec calls out: **the frame must not be black at `multisampling: 0`.** `WallName.tsx:52-62` sanitises normals that would otherwise be NaN, and a NaN written into the HDR buffer spreads through the bloom's mipmap chain and composites the whole screen black. That path has only ever been exercised with MSAA on. If `tier-medium.png` or `tier-low.png` is black, that is this bug, not a tiering bug — the fix belongs in `sanitizeNormals`, and the halo geometry in `outlineOf` needs the same treatment it already gets.

Also compare `tier-high.png` against `shots/driver.png` from Task 4. The bloom should be identical: high tier runs the luminance pass at scale 1, which is where it has always run.

- [ ] **Step 5: Commit**

```bash
git add src/three/Experience.tsx
git commit -m "Tier the antialiasing and the bloom's luminance pass

8x MSAA on a half-float target was the single largest cost in the frame.
High tier keeps real MSAA at 2x for the wall sign's sub-pixel bevels, which
SMAA handles worse; medium takes SMAA, low takes neither.

Bloom scales via luminancePass.resolution, not the Bloom component's
resolutionScale — the latter is dead under mipmapBlur, since BloomEffect
hands the full size to both the luminance pass and the mipmap chain. High
tier stays at scale 1, so its bloom is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Budget the key light's shadow map

The single biggest remaining cost: ~300k triangles redrawn from scratch every frame, for a room where the only thing moving is a plant leaning a third of a degree.

**Files:**
- Modify: `src/three/Lighting.tsx` — lines 8-12 (the `LAMP_SHADOW` constant), 19-35 (refs and the mount effect), 37-49 (the frame body), 82-110 (the light JSX)

**Interfaces:**
- Consumes: `useQuality` (`fixed.keyShadowMap`, `fixed.lampShadowMap`), `isMoving` from `src/quality.ts`.
- Produces: nothing new.

- [ ] **Step 1: Replace the mobile shadow constant with the tier**

In `src/three/Lighting.tsx`, delete lines 8-12:

```tsx
/**
 * Phones get a half-resolution shadow map for the lamp. Decided once at mount:
 * changing `mapSize` later forces the map to be reallocated, and at phone size
 * nobody can tell 512 from 1024 in a soft pool of light.
 */
const LAMP_SHADOW = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 512 : 1024
```

and replace with:

```tsx
/**
 * How often the key light's shadow map is redrawn while the room is still.
 *
 * Plant.tsx sways 0.006 rad — a third of a degree — on a sine that never
 * stops, and that is the only thing moving in an idle scene. A soft shadow
 * drifting by that much is invisible at five redraws a second, and the map was
 * costing a full 300k-triangle depth pass on every one of the other 115.
 */
const KEY_SHADOW_HZ = 5
```

Add to the imports at the top:

```tsx
import { isMoving, useQuality } from '../quality'
```

- [ ] **Step 2: Add the refresh budget**

Replace lines 19-49 — from `export function Lighting() {` down to the end of the `if (key.current) { ... }` block — with:

```tsx
export function Lighting() {
  const scene = useThree((s) => s.scene)
  const fixed = useQuality((s) => s.fixed)
  const ambient = useRef<THREE.HemisphereLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const lamp = useRef<THREE.SpotLight>(null)
  const lampTarget = useRef<THREE.Object3D>(null)
  const nextKeyShadow = useRef(0)

  useLayoutEffect(() => {
    // Draw both shadow maps once at startup, while it is still dark.
    //
    // The map has to exist before anything samples it: a shadow-casting light
    // whose map was never rendered leaves a plain colour texture bound to a
    // sampler2DShadow, which the driver rejects outright
    // (GL_INVALID_OPERATION) and the frame is lost. autoUpdate below then
    // stops either being redrawn every frame.
    if (lamp.current) lamp.current.shadow.needsUpdate = true
    if (key.current) {
      // The key light gets the treatment the lamp already had and
      // ContactShadows already had (frames={1}, Room.tsx:67). It was the one
      // light in the scene still paying for a full redraw every frame.
      key.current.shadow.autoUpdate = false
      key.current.shadow.needsUpdate = true
    }
  }, [])

  useFrame((state) => {
    // intro.lights ramps the room up on load. The lamp is deliberately left out
    // of it — that one is the visitor's switch, not part of the opening.
    const up = intro.lights

    if (ambient.current) {
      mixColor(ambient.current.color, 'ambient')
      ambient.current.intensity = mixNumber('ambientIntensity') * up
    }
    if (key.current) {
      mixColor(key.current.color, 'keyColor')
      key.current.intensity = mixNumber('keyIntensity') * up

      // Only geometry moving changes a shadow map — it is a depth pass, so the
      // ramp above and the day/night dissolve do not dirty it. three clears
      // needsUpdate itself once the map has been drawn.
      const now = state.clock.elapsedTime
      if (isMoving() || now >= nextKeyShadow.current) {
        key.current.shadow.needsUpdate = true
        nextKeyShadow.current = now + 1 / KEY_SHADOW_HZ
      }
    }
```

Leave the rest of the `useFrame` body — the `lamp.current` block at lines 50-69 and the background/fog block at 70-75 — exactly as it is.

- [ ] **Step 3: Take the map sizes from the tier**

In the JSX, change the key light's `shadow-mapSize` (line 88):

```tsx
        shadow-mapSize={[2048, 2048]}
```

to:

```tsx
        shadow-mapSize={[fixed.keyShadowMap, fixed.keyShadowMap]}
```

and the lamp's (line 107):

```tsx
        shadow-mapSize={[LAMP_SHADOW, LAMP_SHADOW]}
```

to:

```tsx
        shadow-mapSize={[fixed.lampShadowMap, fixed.lampShadowMap]}
```

Both read from the frozen half of the profile, so neither ever changes after mount — which is the constraint that put them there. The old `LAMP_SHADOW` made the same call from the same signal; the tier just makes it once, in one place, alongside every other decision of its kind.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean. `LAMP_SHADOW` must have no remaining references.

- [ ] **Step 5: Verify the shadows are still there**

```bash
node scripts/shot.mjs http://localhost:5180 shots/shadow-day.png
node scripts/shot.mjs http://localhost:5180 shots/shadow-night.png --dark
```

Expected: `console: clean` on both. Check three things in the images:

1. The key light's shadows are present — the desk and chair still cast onto the floor. A blank shadow map renders as *no* shadow, not a black screen, so this is a look-at-it check.
2. The lamp's pool of warm light in `shadow-night.png` still has shadows in it.
3. No `GL_INVALID_OPERATION` in the console output, which is what an unrendered map bound to a `sampler2DShadow` produces.

Then check the map is actually refreshing: run the dev server, hover a prop and watch its shadow follow the lift. It should track smoothly, because a hover pokes `isMoving`.

- [ ] **Step 6: Commit**

```bash
git add src/three/Lighting.tsx
git commit -m "Budget the key light's shadow map

autoUpdate=false with needsUpdate driven at 5Hz while the room is still, and
every frame while anything is moving. It was redrawing ~300k triangles from
scratch 120 times a second so that a plant could lean a third of a degree.

This is the treatment the lamp already had and ContactShadows already had,
applied to the one light that never got it. Both map sizes now come from the
frozen half of the quality profile, which is where the old coarse-pointer
check for the lamp belonged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Drop the heavy models out of the shadow passes

200k triangles of the scene's ~320k are three models. Excluding them from both shadow passes leaves the main pass untouched — they still render, still receive shadows, and `ContactShadows` already grounds them.

**Files:**
- Modify: `src/three/Model.tsx` — `ModelProps` (lines 108-123), `Model` (lines 125-159)
- Modify: `src/three/props/Plant.tsx` — line 19
- Modify: `src/three/props/Guitars.tsx` — `HungProps` (34-43), `Hung` (58-84), `Guitars` (101-111)
- Modify: `src/three/props/VhsShelf.tsx` — line 54

**Interfaces:**
- Consumes: `useQuality` (`dynamic.heavyShadowCasters`).
- Produces: `Model` gains an optional `castShadow?: boolean` prop, default `true`. `Hung` gains an optional `castShadow?: boolean` prop, default `true`.

This adds `src/three/Model.tsx` to the spec's file list. `useModel` sets `castShadow = true` on every mesh of every clone it hands out (`Model.tsx:40-49`), so there is nowhere else to override it from. One optional prop on the shared loader is a smaller change than three call sites each traversing their own subtree.

- [ ] **Step 1: Add the prop to `Model`**

In `src/three/Model.tsx`, add to `ModelProps` (after the `scale` line, before the `ground` doc comment):

```tsx
  /**
   * Whether this model takes part in the shadow passes.
   *
   * Safe to change at runtime, unlike a *light's* castShadow — a mesh flag is
   * shadow-pass membership, not a shader variant, so nothing recompiles. The
   * heavy models are excluded on lower tiers: they are most of the scene's
   * triangles and they were being redrawn in full by two separate depth
   * passes. ContactShadows grounds them either way.
   */
  castShadow?: boolean
```

Change the signature (line 125):

```tsx
export function Model({ name, position, rotation, scale, ground = false }: ModelProps) {
```

to:

```tsx
export function Model({
  name,
  position,
  rotation,
  scale,
  ground = false,
  castShadow = true,
}: ModelProps) {
```

and add this effect immediately after `const holder = useRef<THREE.Group>(null)` (line 127):

```tsx
  // useModel hands out clones with castShadow already on, so this is an
  // override rather than the initial setting. Re-runs when the flag moves,
  // which is what makes the quality ratchet able to reach it.
  useLayoutEffect(() => {
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = castShadow
    })
  }, [object, castShadow])
```

- [ ] **Step 2: Thread it through the plant**

Replace the whole of `src/three/props/Plant.tsx`:

```tsx
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LAYOUT } from '../../data/scene'
import { Interactive } from '../Interactive'
import { Model } from '../Model'
import { useQuality } from '../../quality'

export function Plant() {
  const group = useRef<THREE.Group>(null)
  // 115k triangles, and alpha-mapped foliage that decimates badly — so it is
  // dropped from the shadow passes rather than from the scene.
  const heavy = useQuality((s) => s.dynamic.heavyShadowCasters)

  useFrame((state) => {
    // Barely-there sway, enough to stop the scene reading as a still render.
    if (group.current) group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.006
  })

  return (
    <Interactive id="plant" passive>
      <group ref={group} position={LAYOUT.plant.position}>
        <Model name="plant" rotation={[0, 0.8, 0]} castShadow={heavy} />
      </group>
    </Interactive>
  )
}
```

- [ ] **Step 3: Thread it through the bass**

In `src/three/props/Guitars.tsx`, add to the imports:

```tsx
import { useQuality } from '../../quality'
```

Add to `HungProps` (after the `upright` field, inside the type):

```tsx
  /** Whether this instrument takes part in the shadow passes. */
  castShadow?: boolean
```

Change the `Hung` signature (line 58):

```tsx
function Hung({ model, z, bottom, scale = 1, upright = false }: HungProps) {
```

to:

```tsx
function Hung({ model, z, bottom, scale = 1, upright = false, castShadow = true }: HungProps) {
```

and pass it to both `<Model>` calls inside `Hung` (lines 74 and 78):

```tsx
        {upright ? (
          <group rotation={[0, Math.PI / 2, 0]}>
            <Model name={model} scale={scale} castShadow={castShadow} />
          </group>
        ) : (
          <group rotation={[0, 0, -Math.PI / 2]}>
            <Model name={model} scale={scale} castShadow={castShadow} />
          </group>
        )}
```

Then in `Guitars`, add the store read after the `useAudio` line:

```tsx
  const heavy = useQuality((s) => s.dynamic.heavyShadowCasters)
```

and change the bass (line 106):

```tsx
        <Hung model="bass" z={-0.38} bottom={0.92} upright />
```

to:

```tsx
        {/* 40k triangles on a wall, where its own shadow falls on the wall
            directly behind it and reads as almost nothing. The guitar is half
            the size and stays. */}
        <Hung model="bass" z={-0.38} bottom={0.92} upright castShadow={heavy} />
```

Leave the guitar at line 107 alone — it is 20k triangles and not on the list.

- [ ] **Step 4: Thread it through the sonycam**

In `src/three/props/VhsShelf.tsx`, add the imports:

```tsx
import { useQuality } from '../../quality'
```

Add the store read at the top of `VhsShelf`, after `const navigate = useNavigate()`:

```tsx
  // 45k triangles sitting on a shelf in a corner, where ContactShadows and the
  // shelf itself do the grounding.
  const heavy = useQuality((s) => s.dynamic.heavyShadowCasters)
```

and change line 54:

```tsx
          <Model name="sonycam" />
```

to:

```tsx
          <Model name="sonycam" castShadow={heavy} />
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Check the models still render, and still receive shadows**

```bash
node scripts/shot.mjs "http://localhost:5180/?tier=high" shots/casters-high.png
node scripts/shot.mjs "http://localhost:5180/?tier=low" shots/casters-low.png
```

Expected: `console: clean` on both. The plant, bass and sonycam must be **fully visible** in both — this changes what casts a shadow, never what renders. In `casters-low.png` the plant's cast shadow on the floor is gone; the soft `ContactShadows` pool under it is not, and that is what keeps it grounded.

- [ ] **Step 7: Commit**

```bash
git add src/three/Model.tsx src/three/props/Plant.tsx src/three/props/Guitars.tsx src/three/props/VhsShelf.tsx
git commit -m "Drop the heavy models out of the shadow passes below high tier

The plant, bass and sonycam are 200k of the scene's ~320k triangles, and each
was being redrawn in full by two depth passes. They still render and still
receive shadows; ContactShadows already grounds them.

Mesh castShadow is shadow-pass membership, not a shader variant, so unlike a
light's castShadow this is safe for the runtime ratchet to move.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Tier the wall sign's lamp count

Contains the one genuine trap in this task list: at one lamp the existing spacing arithmetic divides by zero.

**Files:**
- Modify: `src/three/props/WallName.tsx` — lines 26-36 (the `WASH_LAMPS` constant), 115-146 (component head and layout effect), 163-167 (the per-lamp intensity), 216-233 (the lamp JSX)

**Interfaces:**
- Consumes: `useQuality` (`fixed.signLamps`).
- Produces: nothing new.

- [ ] **Step 1: Replace the constant with the profile**

In `src/three/props/WallName.tsx`, replace lines 26-34 — the `WASH_LAMPS` doc comment and constant — with:

```tsx
/**
 * How many lamps sit in the cavity behind the letters.
 *
 * One will not do it, which is why the count is three wherever there is room
 * for it. The cavity is 8mm deep and the word is nearly 800mm wide, so a
 * single lamp is 100x closer to the wall directly behind it than to the ends
 * of the phrase — it burns a hotspot behind the middle and leaves the M and
 * the t unlit. A row of them washes the whole word evenly, the way the strip
 * inside a real channel letter does.
 *
 * Low tier takes the hotspot. Three point lights are three more sets of
 * fragment-shader work on every MeshStandardMaterial in the room, and on a
 * phone that costs more than an even wash is worth. The count comes from the
 * frozen half of the profile and never moves: changing how many lights a
 * scene has makes three recompile every material in it.
 */
```

Keep `WASH_SPREAD` at line 35-36 exactly as it is.

- [ ] **Step 2: Read the count, and fix the spacing at one lamp**

Add to the imports:

```tsx
import { useQuality } from '../../quality'
```

In `WallName`, add after `const toggleSign = useScene((s) => s.toggleSign)` (line 120):

```tsx
  const lamps = useQuality((s) => s.fixed.signLamps)
```

Replace the spacing block at the end of the layout effect (lines 139-145):

```tsx
    if (!faces) return
    faces.computeBoundingBox()
    const width = faces.boundingBox ? faces.boundingBox.max.x - faces.boundingBox.min.x : 0
    wash.current.forEach((light, i) => {
      if (!light) return
      light.position.x = (i / (WASH_LAMPS - 1) - 0.5) * width * WASH_SPREAD
    })
  }, [])
```

with:

```tsx
    if (!faces) return
    faces.computeBoundingBox()
    const width = faces.boundingBox ? faces.boundingBox.max.x - faces.boundingBox.min.x : 0
    wash.current.forEach((light, i) => {
      if (!light) return
      // The single-lamp case is not a degenerate spacing, it is the centre:
      // i / (lamps - 1) divides by zero at one lamp, and a NaN on a light's
      // position takes the sign out entirely.
      light.position.x = lamps > 1 ? (i / (lamps - 1) - 0.5) * width * WASH_SPREAD : 0
    })
  }, [lamps])
```

- [ ] **Step 3: Divide the intensity by the real count**

Replace lines 163-166:

```tsx
    // Split between the lamps so the row is no brighter overall than the single
    // one it replaced — this is about spreading the light, not adding more.
    const perLamp = ((0.3 + night * 0.8) / WASH_LAMPS) * on
    for (const light of wash.current) if (light) light.intensity = perLamp
```

with:

```tsx
    // Split between the lamps so the row is no brighter overall than the single
    // one it replaced — this is about spreading the light, not adding more.
    // Dividing by the live count is what keeps the sign the same brightness at
    // one lamp as at three, rather than a third as bright.
    const perLamp = ((0.3 + night * 0.8) / lamps) * on
    for (const light of wash.current) if (light) light.intensity = perLamp
```

- [ ] **Step 4: Build the right number of lamps**

Replace the lamp JSX (lines 221-233):

```tsx
        {Array.from({ length: WASH_LAMPS }, (_, i) => (
```

with:

```tsx
        {Array.from({ length: lamps }, (_, i) => (
```

Leave the rest of that block unchanged, including the comment above it at lines 216-220 — it explains why the lamps are declared statically rather than added on click, which is still exactly why.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean. `WASH_LAMPS` must have no remaining references.

- [ ] **Step 6: Check the sign lights at every tier**

```bash
node scripts/shot.mjs "http://localhost:5180/?tier=high" shots/sign-high.png --dark
node scripts/shot.mjs "http://localhost:5180/?tier=low" shots/sign-low.png --dark
```

Expected: `console: clean`. In both images the wall sign must be lit and the wall behind it washed. `--dark` is what makes this legible: the halo carries the sign by day, and the wall wash is only obviously present at night.

At low tier the wash will be visibly hotter in the middle and dimmer at the M and the t — that is the documented trade, not a failure. What *is* a failure: the sign unlit, or the letters lit with no wash on the wall at all. Either means the lamps got a NaN position, which is the divide-by-zero from Step 2.

- [ ] **Step 7: Commit**

```bash
git add src/three/props/WallName.tsx
git commit -m "Take the wall sign's lamp count from the quality profile

Three point lights are three more sets of fragment work on every standard
material in the room. Low tier drops to one and takes the hotspot.

The spacing arithmetic divided by (count - 1), which is a NaN position at one
lamp and a sign that vanishes. The intensity split now divides by the live
count, so the sign is the same brightness either way.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The costs outside the canvas

Neither of these is WebGL, and both are real. The video preload is the single largest network cost on the site.

**Files:**
- Modify: `src/ui/pages/Videography.tsx` — line 29
- Modify: `src/styles.css` — around line 560

**Interfaces:**
- Consumes: `<html data-tier>`, written by `bootQuality()` in Task 1.
- Produces: nothing.

- [ ] **Step 1: Stop preloading every video in full**

In `src/ui/pages/Videography.tsx`, change line 29:

```tsx
              <video controls loop muted={muted} playsInline preload="auto" poster={f.poster}>
```

to:

```tsx
              {/* metadata, not auto: preload="auto" pulled every file in this
                  grid in full — tens of megabytes — and handed each one to the
                  video decoder, on a page the visitor may only be passing
                  through. The poster is what they see until they press play,
                  and metadata is all that is needed to size the element. */}
              <video controls loop muted={muted} playsInline preload="metadata" poster={f.poster}>
```

- [ ] **Step 2: Ease the backdrop blur on low tier**

In `src/styles.css`, find the `.panel__sheet` rule (the one containing `backdrop-filter: blur(22px)` at line 560) and add this rule immediately after the closing brace of `.panel__sheet`:

```css
/*
 * A backdrop blur is recomputed by the compositor every time what is behind it
 * changes, and what is behind this one is the canvas. At 22px over a
 * full-height sheet that is a real cost on a phone, on the routes where people
 * sit still and read. The tier comes from src/quality.ts, which writes it to
 * <html> at boot.
 */
:root[data-tier='low'] .panel__sheet {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: clean.

```bash
node scripts/shot.mjs "http://localhost:5180/?tier=low" shots/sheet-low.png --route=/about
node scripts/shot.mjs "http://localhost:5180/?tier=high" shots/sheet-high.png --route=/about
```

Expected: both show the About sheet over the room, `sheet-low.png` visibly less blurred behind the panel. Text on the sheet must stay readable in both — the sheet's own `rgba(13, 17, 23, 0.82)` background is carrying most of the contrast, not the blur.

Check the video change in a browser: open `/videography` with the network panel open and confirm the `.mp4` requests are now short range requests rather than full downloads.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/Videography.tsx src/styles.css
git commit -m "Costs outside the canvas: video preload and the sheet blur

preload=auto pulled every video in the grid in full on page load and handed
each to the decoder. metadata is all the element needs to size itself, and
the poster is what anyone sees until they press play.

The sheet's 22px backdrop blur is recomputed by the compositor on every
canvas update beneath it. Low tier takes 10px.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Measure it, and check nothing broke

The spec is explicit: no performance claim goes in the PR without the harness's output. This task is where the estimate in the spec — ~8x less GPU work while interacting, ~20x idle — is either confirmed or replaced with the truth.

**Files:**
- Create: `perf/after.json`, `perf/after-low.json` (gitignored — the numbers go in the PR body)
- Modify: none

- [ ] **Step 1: Measure the branch**

```bash
npm run dev -- --port 5180 &
node scripts/perf.mjs http://localhost:5180 --label=after --json=perf/after.json
node scripts/perf.mjs http://localhost:5180 --tier=low --label=after-low --json=perf/after-low.json
```

- [ ] **Step 2: Build the before/after table**

Put `perf/before.json` from Task 2 beside these and write the table out by hand — four rows, `before` and `after` × `idle` and `active`, with `drawCallsPerSecond` and `trianglesPerSecond`. Save it for the PR body.

State the ratio that the numbers actually support. If it is 4x rather than 8x, the PR says 4x. The estimate in the spec was arithmetic off the settings and was labelled as such; this is the measurement that replaces it.

- [ ] **Step 3: Run the spec's correctness checks**

These are not performance. Each one is a specific regression this work could plausibly have caused.

```bash
node scripts/shot.mjs http://localhost:5180 shots/final-day.png
node scripts/shot.mjs http://localhost:5180 shots/final-night.png --dark
node scripts/shot.mjs http://localhost:5180 shots/final-xray.png --xray
node scripts/shot.mjs http://localhost:5180 shots/final-guide.png --guide
node scripts/shot.mjs http://localhost:5180 shots/final-mobile.png --mobile
node scripts/shot.mjs http://localhost:5180 shots/final-intro.png --at=900
```

- [ ] The first lamp click does not stall. In a browser, load the page and click the lamp. It must go dark immediately. A multi-second freeze means a light's `castShadow` or the light count moved at runtime, which recompiles every material — the exact bug `Lighting.tsx:52-58` was written to prevent, and the one thing in this codebase that has bitten hardest.
- [ ] The wall sign lights at every tier. Covered by Task 8's screenshots; confirm `final-night.png` again after everything has landed.
- [ ] The intro runs to completion. `final-intro.png` is taken 900ms in, partway through the ramp, and must show the room *partly* lit — not fully lit (the ramp completed instantly, meaning the delta is wrong) and not black (the ramp never started, meaning `intro.t` is not advancing). `theme.ts:62-74` accumulates it from frame deltas, which the capped loop changes the size of.
- [ ] No black frames at `multisampling: 0`. Covered by Task 5; re-check `shots/tier-low.png` and move the mouse around the wall sign in a browser at `?tier=low` for thirty seconds. `WallName.tsx:38-52` explains why this one only shows up while the pointer moves.
- [ ] X-ray mode still reports its counters. `final-xray.png` must show non-zero triangle and mesh counts in the HUD. `XRay.tsx:66-72` samples on a 0.5s timer off `clock.getElapsedTime()`, and the clock is now driven by the driver's timestamp.
- [ ] The mobile scrubber still pans. `final-mobile.png` must show the scrubber. Drag it in a browser at a phone viewport and confirm the room moves — `pan` changes are in the driver's poke list, so the pan should be smooth rather than stepped.
- [ ] Guided mode still places its labels. `final-guide.png` must show hotspot labels over the props. `Interactive.tsx:94-99` measures each bounding box on the first frame after the label is asked for, which under a capped loop can be up to 40ms later.

- [ ] **Step 4: Full check and commit**

```bash
npm test && npm run typecheck && npm run build
```

Expected: 18 tests passing, clean typecheck, successful build.

```bash
git add -A
git commit -m "Verify the tier work against the harness

<paste the before/after table>

Correctness checks in the spec all pass: no stall on the first lamp click,
the sign lights at every tier, the intro ramp still runs on frame deltas, no
black frames at multisampling 0.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Out of scope

Carried from the spec, and none of it is a follow-up hiding as an exclusion:

- Further model decimation. The sources are not on disk and the plant is already at `ratio: 0.15` from a ~770k source.
- Removing or altering any visual effect.
- Instancing, LOD, texture atlasing.
- A user-facing quality override in the HUD.

One deliverable the spec asks for that this plan does **not** build: the side-by-side prototype of `multisampling: 2` against `0 + SMAA` on the wall sign. Tasks 5 and 8 make both reachable from a query param — `?tier=high` and `?tier=medium` differ in exactly that, and `shots/tier-high.png` and `shots/tier-medium.png` are the comparison. That is the prototype, and it costs nothing extra. Which one high tier ships is a judgement to make after looking at them; until then it ships `2`, as the spec says.
