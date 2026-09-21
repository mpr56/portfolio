# Tiered render quality

**Status:** approved, not yet implemented
**Date:** 2026-09-21

## Problem

The scene renders continuously at the display's refresh rate — 120 fps on a
ProMotion Mac — at DPR 2, with 8× MSAA on a half-float HDR target, six dynamic
lights, and a 2048² shadow map redrawn from scratch every frame. A 14" MacBook
Pro (M4 Pro) runs hot within ten minutes of the page being open and idle.

Almost none of that cost is the visual effects themselves. It is the rate and
the sampling resolution at which they are paid for. Nothing in this design
removes an effect: bloom, vignette, the lamp, the shadows and the wall sign all
survive unchanged.

## Measured baseline

Read off the source, not profiled — `scripts/perf.mjs` (below) exists to replace
these estimates with numbers.

| Cost | Where | Per frame |
|---|---|---|
| 8× MSAA on RGBA16F | `@react-three/postprocessing` default `multisampling = 8`, not overridden in `Experience.tsx:57` | ~5.94M px × 8 samples |
| Key light shadow map | `Lighting.tsx:82-93`, `shadow.autoUpdate` left at default `true` | ~300k tris, full redraw |
| Uncapped frame loop | `<Canvas>` default `frameloop="always"` | ×120 per second |
| DPR ceiling 2 | `PerformanceMonitor.onIncline`, `Experience.tsx:106` | 4× the pixels of DPR 1 |
| Six dynamic lights | hemisphere + directional + spot + 3× point (`WallName.tsx:221-234`) | every `MeshStandardMaterial` fragment |
| Redundant `antialias: true` | `Experience.tsx:79` | dead — the composer owns the pipeline |

Scene geometry, from the GLB accessors:

| model | tris | model | tris |
|---|---|---|---|
| plant | 115,483 | car2 | 35,595 |
| sonycam | 45,100 | guitar | 20,419 |
| bass | 40,575 | *all others* | ~65,000 |

## Constraints discovered

These are the facts that shape the design. Each is already documented somewhere
in the codebase; this collects them.

**1. Light topology cannot change at runtime.** Changing how many lights a scene
has, or which of them cast shadows, makes three.js recompile every material —
measured at 36 programs, a multi-second stall on desktop and 20-30s on a phone.
`Lighting.tsx:52-58` and `WallName.tsx:216-220` are both already shaped around
this. A naive "demote the tier at runtime" design would fire exactly that stall.

**2. Shadow map size cannot change cheaply.** Changing `mapSize` reallocates the
map; `Lighting.tsx:8-12` already decides the lamp's size once at mount.

**3. Composer multisampling cannot change cheaply.** Changing it rebuilds the
composer's render targets.

**4. The scene is never fully still.** `Plant.tsx:11-14` sways 0.006 rad (0.34°)
on a sine forever. This rules out `frameloop="demand"` — the damps in `Rig.tsx`
and `theme.ts` are asymptotic and never exactly settle either. It does *not*
rule out a low shadow refresh rate: 0.34° of drift on a soft shadow is invisible
at 5 Hz.

**5. Everything else that moves is event-driven and brief.** The record spins
only while `isPlaying` (`VinylPlayer.tsx:39-43`), the car shakes only while
`running` (`CarModel.tsx:73-82`), the guitars sway on a 2.4s decay
(`Guitars.tsx:92-99`), hover lifts damp over ~200ms (`Interactive.tsx:120-121`).

**6. Model sources are not on disk.** `scripts/optimize.mjs` reads from
`internet3dmodels/`, which is absent from the working tree. Nothing in this
design may require re-running `npm run models`.

**7. The plant is already decimated.** `ratio: 0.15` at `optimize.mjs:135-141`,
from a ~770k-triangle source. It is alpha-mapped foliage, which decimates badly.
Further decimation is not available as a lever; excluding it from the shadow
passes is.

## Design

### Quality profile, split by mutability

New module `src/quality.ts`, exposing a `useQuality` zustand store alongside the
existing `useScene`. The profile splits in two along constraints 1-3:

```ts
/** Decided once at boot. Changing any of these mid-session recompiles every
 *  material or reallocates a render target — see constraints 1-3. */
type StaticQuality = {
  multisampling: number   // composer MSAA samples
  smaa: boolean           // cheap post-AA, used when MSAA is off
  keyShadowMap: number    // directional shadow map edge, px
  lampShadowMap: number   // spot shadow map edge, px
  signLamps: number       // wall-sign point lights
}

/** Safe to change at any time: no shader variants, no reallocation. */
type DynamicQuality = {
  dpr: number
  bloomScale: number
  idleFps: number
  activeFps: number
  heavyShadowCasters: boolean  // plant, bass, sonycam in the shadow passes
}
```

The runtime ratchet moves **only the dynamic half**.

This yields the governing principle for the boot heuristic: **conservative on
the static half, optimistic on the dynamic half.** Only the dynamic half can be
corrected later, and the static half is the half nobody can see.

### Tier assignment (hybrid, one-way ratchet)

**Boot heuristic** picks a starting tier from `matchMedia('(pointer: coarse)')`,
`navigator.hardwareConcurrency`, `navigator.deviceMemory` (absent in Safari —
treat as unknown, not as low), and `window.screen` size. It sets the static
profile permanently and the dynamic profile's starting index.

**Runtime ratchet** may step the dynamic profile down, never up.

Drei's `PerformanceMonitor` and `AdaptiveDpr` are **removed** from
`Experience.tsx`. They are incompatible with a capped loop: `PerformanceMonitor`
derives its factor from observed fps against bounds, so a deliberate 30 fps cap
reads to it as a struggling device and triggers `onDecline` spuriously. They
also currently fight each other over DPR ownership.

They are replaced by a measurement that is correct under a cap: the frame driver
wall-clocks the `advance()` call itself, which measures frame *cost* independent
of frame *rate*. If the median cost over a 2s window exceeds 70% of the budget
implied by the current target fps, for two consecutive windows, the dynamic
profile steps down one index. Never up.

Dynamic profiles are an ordered array; demotion is an index increment, so the
ratchet is a single integer and cannot oscillate.

### Frame loop

`<Canvas frameloop="never">`, plus one driver component inside the Canvas that
holds a `requestAnimationFrame` loop and calls `advance(t)` on a budget.
`advance` is on the R3F root store — `useThree((s) => s.advance)`, typed at
`@react-three/fiber/dist/declarations/src/core/store.d.ts:112`.

Budget:

| State | Target |
|---|---|
| Idle | `idleFps` (30 on high/medium) |
| ~800ms after any interaction — pointer move, click, route change, theme toggle | `activeFps` (60 on high/medium) |
| While a route sheet is open | 15 fps, and DPR × 0.75 |

The sheet case is free: `styles.css:560` puts `backdrop-filter: blur(22px)` over
the canvas on those routes, so the scene is already blurred past legibility.

Pointer events are DOM-driven and continue to work under `frameloop="never"`.

### Tier table

| | high | medium | low |
|---|---|---|---|
| DPR ceiling | 1.5 | 1.25 | 1.0 |
| multisampling | 2 | 0 | 0 |
| SMAA | – | yes | no |
| bloom scale | 0.5 | 0.5 | 0.35 |
| key shadow map | 2048 | 1024 | 1024 |
| lamp shadow map | 1024 | 512 | 512 |
| sign lamps | 3 | 3 | 1 |
| idle / active fps | 30 / 60 | 30 / 60 | 24 / 40 |
| heavy shadow casters | yes | no | no |

Read this table as two tables stacked. The first five rows below the header are
the **static** profile, chosen once by the boot heuristic and then frozen. The
last four rows are the **dynamic** profile, and the three columns are literally
the ordered array the ratchet walks: index 0, 1, 2. The boot heuristic's tier
choice sets both the frozen static profile and the dynamic array's *starting
index*.

A consequence the implementation must not "fix": a device that boots high and
demotes twice ends up on dynamic index 2 while keeping high's static profile —
`multisampling: 2`, a 2048 key shadow map, 3 sign lamps. That is correct and
intended. The static half is frozen by constraints 1-3, and it is also the half
with the least perceptual cost to keep. Only the dynamic half moves.

`antialias: true` is dropped from the `gl` props in `Experience.tsx:79` at all
tiers. It is dead weight — the composer renders to its own target, so the
default framebuffer's MSAA never resolves anything visible.

High tier ships `multisampling: 2` rather than `0` + SMAA. The wall sign is
extruded `Text3D` with sub-pixel bevels (`WallName.tsx:205-207`), and SMAA
handles thin geometry worse than real MSAA; 2× is still 4× cheaper than the
current 8×. A side-by-side prototype of `2` vs `0 + SMAA` on the wall sign is a
deliverable of the implementation plan, for evaluation after this work lands.
Until that evaluation happens, `2` is what ships.

### Shadows

`key.shadow.autoUpdate = false`, with `needsUpdate = true` driven on a budget:

- once immediately after load
- at ~5 Hz baseline, which covers the plant's 0.34° sway invisibly
- every frame while any event-driven animation is live — `isPlaying` on
  vinyl/guitars/car, or any prop mid-hover-lift

This is the treatment the lamp already has (`Lighting.tsx:64`) and that
`ContactShadows` already has (`frames={1}`, `Room.tsx:67`), applied to the one
light that never got it. It removes ~300k triangles from roughly 115 shadow
passes per second.

When `heavyShadowCasters` is false, `castShadow = false` is set on the plant,
bass and sonycam meshes — 200k triangles out of both shadow passes, main pass
untouched. `ContactShadows` already grounds them. Mesh `castShadow` is a
shadow-pass inclusion flag, not a shader variant, so this one *is* safe to
change at runtime (constraint 1 does not apply).

### Outside the canvas

- `Videography.tsx:29`: `preload="auto"` → `preload="metadata"`. Currently pulls
  47MB and hands it to the video decoder on page load.
- `styles.css:560`: `blur(22px)` → `blur(10px)` on low tier. A large-area
  backdrop blur is recomputed by the compositor on every canvas update beneath
  it.

## Files touched

| File | Change |
|---|---|
| `src/quality.ts` | new — profiles, boot heuristic, `useQuality` store |
| `src/three/FrameDriver.tsx` | new — rAF budget loop, `advance()`, cost measurement, ratchet |
| `src/three/Experience.tsx` | `frameloop="never"`, drop `antialias`, drop `PerformanceMonitor`/`AdaptiveDpr`, tier-driven `dpr` + `multisampling` + bloom scale, mount `FrameDriver` |
| `src/three/Lighting.tsx` | key shadow refresh budget; tier-driven map sizes |
| `src/three/props/WallName.tsx` | `signLamps` from the static profile |
| `src/three/props/Plant.tsx` | `castShadow` from `heavyShadowCasters` |
| `src/three/props/Guitars.tsx` | `castShadow` on bass from `heavyShadowCasters` |
| `src/three/props/VhsShelf.tsx` | `castShadow` on sonycam from `heavyShadowCasters` |
| `src/ui/pages/Videography.tsx` | `preload="metadata"` |
| `src/styles.css` | tier-gated backdrop blur |
| `scripts/perf.mjs` | new — Playwright frame-cost harness |

## Verification

`scripts/perf.mjs`, using the Playwright already in devDependencies and
following the pattern of `scripts/shot.mjs` (which drives state via the
`window.__scene` dev handle):

1. load the page, force a tier via a query param or the dev handle
2. sample `requestAnimationFrame` deltas and `gl.info.render` over 10s idle,
   then 10s with synthetic pointer movement
3. print draw calls, triangles and median frame cost per tier
4. run against `main` and against the branch, print a before/after table

The estimate from the settings arithmetic is ~8× less GPU work while
interacting and ~20× while idle. That is arithmetic, not a measurement. The
script is how we find out whether it is true, and no performance claim gets made
in the PR without its output.

Correctness checks that are not performance:

- the first lamp click still does not stall (constraint 1 did not regress)
- the wall sign still lights, at every tier
- the intro sequence still runs to completion under the capped loop —
  `theme.ts:62-74` accumulates `intro.t` from frame deltas
- no black-frame regression from the `sanitizeNormals` NaN path
  (`WallName.tsx:52-62`) at `multisampling: 0`

## Explicitly out of scope

- Further model decimation (constraints 6 and 7)
- Removing or altering any visual effect
- Instancing, LOD, or texture atlasing
- A user-facing quality override in the HUD
