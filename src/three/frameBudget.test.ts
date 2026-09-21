import { beforeEach, describe, expect, it } from 'vitest'
import { FrameBudget, MIN_SAMPLES, STRIKES, WARMUP_MS, WINDOW_MS } from './frameBudget'

const TARGET = 60
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
