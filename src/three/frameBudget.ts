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
