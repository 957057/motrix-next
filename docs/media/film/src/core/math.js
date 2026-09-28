/** Deterministic math helpers. Never use Math.random or wall-clock time in the film. */

export const TAU = Math.PI * 2

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, x) => clamp((x - a) / (b - a))
export const smooth = (x) => x * x * (3 - 2 * x)
export const smoothstep = (a, b, x) => smooth(invLerp(a, b, x))
export const fract = (x) => x - Math.floor(x)

/** Integer hash to [0, 1). */
export function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663))
export const hash3 = (a, b, c) =>
  hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791))

/** Smooth 1D value noise in [0, 1). */
export function noise1(x, seed = 0) {
  const i = Math.floor(x)
  return lerp(hash2(seed, i), hash2(seed, i + 1), smooth(x - i))
}

/** Signed fractal noise in roughly [-1, 1]. */
export function fbm1(x, seed = 0, octaves = 3) {
  let v = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    v += (noise1(x * freq, seed + i * 17) * 2 - 1) * amp
    freq *= 2
    amp *= 0.5
  }
  return v / 0.875
}

/** Deterministic permutation of [0, n). */
export function permutation(n, seed) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash2(seed, i) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Colour ────────────────────────────────────────────────────────────────

const rgbCache = new Map()

export function hexToRgb(hex) {
  let c = rgbCache.get(hex)
  if (c) return c
  const h = hex.replace('#', '')
  const v =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h
  c = [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
  rgbCache.set(hex, c)
  return c
}

export function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${clamp(a)})`
}

export function mixRgb(a, b, t) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return [0, 1, 2].map((i) => Math.round(lerp(A[i], B[i], clamp(t))))
}

export function mix(a, b, t, alpha = 1) {
  const [r, g, bl] = mixRgb(a, b, t)
  return `rgba(${r},${g},${bl},${clamp(alpha)})`
}

/** Mix two hex colours and return hex (for helpers that take hex, like glow). */
export function mixHex(a, b, t) {
  return `#${mixRgb(a, b, t)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

export function shade(hex, k, alpha = 1) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${Math.round(clamp(r * k, 0, 255))},${Math.round(clamp(g * k, 0, 255))},${Math.round(clamp(b * k, 0, 255))},${clamp(alpha)})`
}

// ── Geometry ──────────────────────────────────────────────────────────────

export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

export function bezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ]
}

export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

export function lerpRect(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    r: lerp(a.r ?? 0, b.r ?? 0, t),
  }
}
