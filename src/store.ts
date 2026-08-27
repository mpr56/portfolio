import { create } from 'zustand'

export type PropId =
  | 'monitor'
  | 'vhs'
  | 'lamp'
  | 'vinyl'
  | 'guitars'
  | 'car'
  | 'chair'
  | 'plant'
  | 'desk'
  | 'name'

type SceneState = {
  /** false = daylight, true = lamp-lit night. Driven by clicking the lamp. */
  dark: boolean
  toggleDark: () => void

  muted: boolean
  toggleMuted: () => void

  /**
   * The wall sign's own switch. Independent of dark mode: the lamp lights the
   * room, this lights the letters, and clicking them cuts the glow the way
   * pulling the plug on a real sign would.
   */
  signOn: boolean
  toggleSign: () => void

  /** Which prop the pointer is currently over — drives cursor + hover label. */
  hovered: PropId | null
  setHovered: (id: PropId | null) => void

  /** Which prop is currently making noise, so only one source plays at a time. */
  playing: PropId | null
  setPlaying: (id: PropId | null) => void

  /** Flipped once the intro has been dismissed and the scene is interactive. */
  entered: boolean
  enter: () => void

  /**
   * Horizontal pan, −1…1, driven by the mobile scrubber. On a narrow screen
   * the desk cannot fit in frame, so this orbits the camera to let the whole
   * scene be reached without a drag gesture fighting the page.
   */
  pan: number
  setPan: (v: number) => void
  nudgePan: (delta: number) => void
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export const useScene = create<SceneState>((set, get) => ({
  dark: false,
  toggleDark: () => set({ dark: !get().dark }),

  muted: true,
  toggleMuted: () => set({ muted: !get().muted }),

  signOn: true,
  toggleSign: () => set({ signOn: !get().signOn }),

  hovered: null,
  setHovered: (id) => set({ hovered: id }),

  playing: null,
  setPlaying: (id) => set({ playing: id }),

  entered: false,
  enter: () => set({ entered: true }),

  pan: 0,
  setPan: (v) => set({ pan: clamp(v) }),
  nudgePan: (delta) => set({ pan: clamp(get().pan + delta) }),
}))

// Dev-only handle so scripts/shot.mjs can drive state without faking clicks.
if (import.meta.env.DEV) {
  ;(window as unknown as { __scene: typeof useScene }).__scene = useScene
}

// Hover labels used to float over each prop; they were noisy, so the cursor is
// now the only affordance. Interactive derives clickability from onActivate.
