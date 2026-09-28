/**
 * Easing and tween helpers.
 *
 * Motion follows the Rayburst app: enter decelerates on cubic-bezier(0.2, 0, 0, 1),
 * exit accelerates on cubic-bezier(0.3, 0, 0.8, 0.15), enters run longer than exits,
 * and pop-ups use damped springs.
 */
import { clamp, TAU } from './math.js'

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t) => ((ax * t + bx) * t + cx) * t
  const sy = (t) => ((ay * t + by) * t + cy) * t
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-6) return sy(t)
      const d = dsx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 32; i++) {
      t = (lo + hi) / 2
      if (sx(t) < x) lo = t
      else hi = t
    }
    return sy(t)
  }
}

/** Rayburst motion tokens (README "Design & Motion"). */
export const M3 = {
  enter: cubicBezier(0.2, 0, 0, 1),
  exit: cubicBezier(0.3, 0, 0.8, 0.15),
  emphasized: cubicBezier(0.05, 0.7, 0.1, 1),
  standard: cubicBezier(0.2, 0, 0, 1),
}

export const linear = (x) => clamp(x)
export const inQuad = (x) => x * x
export const outQuad = (x) => 1 - (1 - x) * (1 - x)
export const inCubic = (x) => x * x * x
export const outCubic = (x) => 1 - Math.pow(1 - x, 3)
export const inOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const outQuart = (x) => 1 - Math.pow(1 - x, 4)
export const inOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2
export const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
export const inExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10))
export const inOutExpo = (x) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2
export const outBack = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)

/** Damped spring step response. t in seconds, returns ~0 → 1 with overshoot. */
export function spring(t, { freq = 2.2, damping = 0.55 } = {}) {
  if (t <= 0) return 0
  const w = TAU * freq
  const z = damping
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z)
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
  }
  return 1 - Math.exp(-w * t) * (1 + w * t)
}

/** Normalised progress of t through [start, start + dur]. */
export const prog = (t, start, dur) => clamp((t - start) / dur)

/** Eased progress. */
export const tw = (t, start, dur, ease = M3.enter) => ease(prog(t, start, dur))

/**
 * Presence of an element that enters at `a` and exits at `b`.
 * Enter is longer and decelerating, exit is shorter and accelerating.
 */
export function presence(t, a, b = Infinity, inDur = 0.6, outDur = 0.35) {
  const i = M3.enter(prog(t, a, inDur))
  const o = M3.exit(prog(t, b, outDur))
  return { in: i, out: o, v: i * (1 - o) }
}
