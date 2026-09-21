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
