import * as THREE from 'three'

/**
 * Single source of truth for where everything sits in the signature scene.
 * 1 world unit = 1 metre. The desk top is the anchor plane everything else
 * is measured against, so nudging DESK.height moves the whole tabletop set.
 */
/**
 * L-shaped corner desk, floating with no legs.
 *
 * Defined as two overlapping wings in world space rather than a width/depth
 * pair, because everything on top is placed against these extents. The wings
 * overlap slightly at the seam so no coincident faces z-fight.
 */
export const DESK = {
  height: 0.74,
  /** Chunky on purpose — the slab floats, so the edge is what sells the mass. */
  thickness: 0.13,
  /** The long wing, running left-to-right across the back. */
  back: { x: [-1.12, 1.0] as Span, z: [-0.8, -0.05] as Span },
  /** The return, coming forward toward the viewer on the left. */
  ret: { x: [-1.12, -0.3] as Span, z: [-0.11, 0.95] as Span },
}

/**
 * Centre of the long wing's *clear* span — the part not shared with the
 * return. This is where the monitor belongs; the wing's own midpoint sits at
 * the inside corner and reads as crowded.
 */
export const BACK_CLEAR_CENTER = (-0.3 + 1.35) / 2

export type Span = [number, number]
export const spanCenter = ([a, b]: Span) => (a + b) / 2
export const spanSize = ([a, b]: Span) => b - a

/**
 * The corner the desk is tucked into. Set `enabled: false` for the reference's
 * wall-less floating void — the guitar mounts still read as wall hangers.
 */
export const WALLS = {
  enabled: true,
  back: -0.84,
  left: -1.24,
  height: 3.0,
  extent: 7,
}

/** Desk surface Y — props that sit "on the desk" start here. */
export const SURFACE = DESK.height

/**
 * The monitor takes the return on its own; everything else shares the long
 * wing. Splitting them across the two arms of the L is what stops the desk
 * reading as one crowded row.
 */
export const LAYOUT = {
  desk: { position: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 },
  /** On the return, against the left wall, turned to face across the desk. */
  monitor: {
    position: [-0.85, SURFACE, 0.4] as Vec3,
    rotation: [0, Math.PI / 2 - 0.1, 0] as Vec3,
  },
  /**
   * Face-up on the return, in front of the monitor and clear of its footprint,
   * roughly where a hand would leave it from the chair.
   *
   * The model stands upright with its origin at the base, so the −90° about X
   * is what lays it down; the Z term is applied first in the model's own frame
   * and so spins it in the desk plane once it is flat.
   */
  phone: {
    position: [-0.48, SURFACE, 0.66] as Vec3,
    rotation: [-Math.PI / 2, 0, 0.32] as Vec3,
  },
  /** Long wing, left to right: cameras, car, record player. */
  vhs: { position: [-0.52, SURFACE, -0.34] as Vec3},
  /** Two die-casts side by side between the cameras and the record player. */
  car: { position: [-0.02, SURFACE, -0.28] as Vec3 },
  car2: { position: [0.32, SURFACE, -0.36] as Vec3 },
  car3: { position: [0.12, SURFACE, -0.55] as Vec3},
  vinyl: { position: [0.72, SURFACE, -0.4] as Vec3 },
  /**
   * Dimensional letters on the left wall, above the monitor. Turned a quarter
   * turn so the glyphs face +X off that wall.
   */
  name: {
    position: [WALLS.left + 0.012, 1.52, 0.4] as Vec3,
    rotation: [0, Math.PI / 2, 0] as Vec3,
  },
  /** Tucked into the inside corner, turned toward the monitor. */
  chair: { position: [0.12, 0, 0.78] as Vec3, rotation: [0, -1.8, 0] as Vec3 },
  /** Stands to the right; its arc sweeps back over the long wing. */
  lamp: { position: [1.72, 0, -0.15] as Vec3, rotation: [0, -0.12, 0] as Vec3 },
  /** On the floor, in front of the return. */
  plant: { position: [-0.86, 0, 1.2] as Vec3 },
  /**
   * Hung flat on the back wall now that the monitor occupies the left one. The
   * exact −90° turn matters: the hangers mount along the group's local +X, and
   * anything short of square leaves the instruments floating off the plane.
   */
  guitars: {
    // Kept left of x ≈ 0.1: the lamp's arc sweeps in from x 0.55 and its shade
    // sits at guitar height, so anything further right intersects it.
    position: [0, 0, WALLS.back + 0.02] as Vec3,
    rotation: [0, -Math.PI / 2, 0] as Vec3,
  },
} as const

export type Vec3 = [number, number, number]

/**
 * Camera framing per route. The rig eases between these, which is what makes
 * opening a page feel like the camera walking up to the object rather than a
 * modal appearing over a static render.
 */
export type Shot = { position: Vec3; target: Vec3; fov: number }

export const SHOTS: Record<string, Shot> = {
  '/': { position: [3.5, 2.55, 3.95], target: [-0.1, 0.9, -0.15], fov: 32 },
  '/projects': { position: [0.75, 1.5, 1.55], target: [-0.9, 1.0, 0.4], fov: 36 },
  // Targets must track LAYOUT — this one still aimed at the record player
  // after the cameras and turntable swapped ends of the desk.
  '/videography': { position: [0.5, 1.35, 1.1], target: [-0.52, 0.88, -0.34], fov: 36 },
  '/about': { position: [2.85, 2.0, 3.25], target: [-0.2, 0.95, -0.1], fov: 33 },
  // The only shot that looks down rather than across. A phone lying flat reads
  // as a sliver from every eye-level angle the other shots use.
  //
  // The target sits deliberately off the phone, to its screen-right: the panel
  // covers the right third of the viewport, so aiming straight at the subject
  // parks it under the sheet. Everything else here is wide enough not to care.
  '/contact': { position: [-0.08, 1.32, 1.02], target: [-0.37, 0.77, 0.54], fov: 32 },
}

/**
 * Nested routes inherit their parent's framing, so opening a single project
 * from /projects holds the camera on the monitor instead of snapping back to
 * the wide shot.
 */
export const getShot = (pathname: string): Shot => {
  if (SHOTS[pathname]) return SHOTS[pathname]
  const parent = `/${pathname.split('/')[1] ?? ''}`
  return SHOTS[parent] ?? SHOTS['/']
}

/** Day / night palettes. Every themed material lerps between the two. */
export const PALETTE = {
  day: {
    // Sage. Kept cool and well desaturated on purpose: nearly everything on the
    // desk is warm — the wood, the lamp, the sign — so a cool, muted backdrop
    // pushes them forward. A warm backdrop of the same lightness lets the dark
    // desk dissolve into the wall behind it.
    background: new THREE.Color('#6f8571'),
    fog: new THREE.Color('#6f8571'),
    floor: new THREE.Color('#7d9480'),
    // Tints every object in the scene, not just the backdrop — this is the one
    // to keep muted, or the whole room takes on the cast.
    ambient: new THREE.Color('#a8c0a4'),
    ambientIntensity: 1.15,
    keyColor: new THREE.Color('#fdf6e8'),
    keyIntensity: 2.6,
    lampIntensity: 0.0,
    screenIntensity: 0.35,
    bloom: 0.32,
    vignette: 0.62,
  },
  night: {
    background: new THREE.Color('#161b23'),
    fog: new THREE.Color('#0f141b'),
    floor: new THREE.Color('#232a35'),
    ambient: new THREE.Color('#2b3a52'),
    ambientIntensity: 0.35,
    keyColor: new THREE.Color('#8fa6c4'),
    keyIntensity: 0.22,
    lampIntensity: 26.0,
    screenIntensity: 1.5,
    bloom: 0.95,
    vignette: 0.86,
  },
}

/**
 * Lamp fixture geometry, in the lamp's own space. Shared with <Lighting /> so
 * the spotlight always originates from wherever the shade actually is.
 */
/**
 * Where the shade sits relative to the lamp's post, in the model's own space.
 * The optimised lamp has its origin at the post with the arm reaching to −X,
 * so this is a point along that arm.
 */
export const LAMP_GEOM = { head: [-1.248, 1.6, 0] as Vec3 }

/** World position of the shade — where the spotlight has to be emitted from. */
export const LAMP_HEAD: Vec3 = (() => {
  const [lx, , lz] = LAYOUT.lamp.position
  const ry = LAYOUT.lamp.rotation[1]
  const [ox, oy] = LAMP_GEOM.head
  // Rotation about Y: x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ, with z = 0.
  return [lx + ox * Math.cos(ry), oy, lz - ox * Math.sin(ry)]
})()

/**
 * What the lamp is aimed at. Shared with <Lighting /> and <XRay /> so the
 * spotlight and the cone that visualises it can never point different ways.
 */
export const LAMP_TARGET: Vec3 = [0.1, 0.74, -0.2]

/** Warm pool of light the lamp throws across the desk at night. */
export const LAMP_LIGHT = {
  color: '#ffcf94',
  angle: 0.72,
  penumbra: 0.75,
  distance: 7,
  decay: 1.55,
}
