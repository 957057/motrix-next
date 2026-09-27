/**
 * Easing and timing helpers. Every animation on the page is a function of
 * elapsed time, never of scroll position, so it plays the same however fast
 * the visitor scrolls.
 */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
/** Progress of `t` through the window [start, start + dur], clamped to 0..1. */
export const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur))
export const smooth = (t) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

/** CSS cubic-bezier as a function of x (Newton iterations with a bisection fallback). */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (u) => ((ax * u + bx) * u + cx) * u
  const sy = (u) => ((ay * u + by) * u + cy) * u
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let u = x
    for (let i = 0; i < 6; i++) {
      const e = sx(u) - x
      const d = dx(u)
      if (Math.abs(e) < 1e-5) return sy(u)
      if (Math.abs(d) < 1e-6) break
      u -= e / d
    }
    let lo = 0
    let hi = 1
    u = x
    for (let i = 0; i < 20; i++) {
      const v = sx(u)
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = u
      else hi = u
      u = (lo + hi) / 2
    }
    return sy(u)
  }
}

/** Rayburst's Material 3 curves, plus the film's text curve (rises in one stroke). */
export const ease = {
  enter: cubicBezier(0.2, 0, 0, 1),
  exit: cubicBezier(0.3, 0, 0.8, 0.15),
  standard: cubicBezier(0.2, 0, 0, 1),
  text: cubicBezier(0.33, 1, 0.68, 1),
  inOut: (t) => {
    const x = clamp(t)
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  },
}

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
export const reducedMotion = () => motionQuery.matches

/** Deterministic hash noise in 0..1. */
export function hash(a, b = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Smooth 1-D value noise in -1..1, for gentle speed jitter. */
export function noise(x, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1
}
