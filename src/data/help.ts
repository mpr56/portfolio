import type { PropId } from '../store'

/**
 * What guided mode says about each prop it labels.
 *
 * Keyed by PropId and deliberately partial: a prop earns a label by having an
 * entry here, so the passive scenery (desk, chair, plant) is handled by
 * omission rather than by a second "is this scenery?" flag that could disagree
 * with `passive` on the prop itself.
 *
 * `category` is the bucket the prop belongs to — the three are the only kinds
 * of thing clicking anything in this room can do. `action` is the outcome, in
 * the room's own language rather than the router's.
 */
export type HelpEntry = { category: 'Page' | 'Room' | 'Sound'; action: string }

export const HELP: Partial<Record<PropId, HelpEntry>> = {
  monitor: { category: 'Page', action: 'Projects' },
  vhs: { category: 'Page', action: 'Videography' },
  phone: { category: 'Page', action: 'Contact' },
  lamp: { category: 'Room', action: 'Day / night' },
  name: { category: 'Room', action: 'Sign glow' },
  vinyl: { category: 'Sound', action: 'Play a record' },
  guitars: { category: 'Sound', action: 'Strum a chord' },
  car: { category: 'Sound', action: 'Rev the engine' },
}
