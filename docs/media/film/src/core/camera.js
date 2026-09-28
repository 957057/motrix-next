/**
 * Virtual camera over a 2D world. A camera { x, y, zoom, rot } puts the world
 * point (x, y) at the centre of the 1920×1080 frame, `zoom` screen pixels per
 * world pixel. The UI is vector-drawn, so close-ups stay sharp at any zoom.
 *
 * Rhythm rule: the camera moves, then holds while there is something to read.
 */
import { M3, inOutCubic } from './ease.js'
import { clamp, fbm1, lerp } from './math.js'

export const CX = 960
export const CY = 540

export function applyCamera(ctx, cam) {
  ctx.translate(CX + (cam.dx ?? 0), CY + (cam.dy ?? 0))
  if (cam.rot) ctx.rotate(cam.rot)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)
}

/** World point → screen point. */
export function toScreen(cam, [x, y]) {
  const c = Math.cos(cam.rot ?? 0)
  const s = Math.sin(cam.rot ?? 0)
  const dx = (x - cam.x) * cam.zoom
  const dy = (y - cam.y) * cam.zoom
  return [CX + (cam.dx ?? 0) + dx * c - dy * s, CY + (cam.dy ?? 0) + dx * s + dy * c]
}

/** Screen point → world point. */
export function toWorld(cam, [sx, sy]) {
  const c = Math.cos(-(cam.rot ?? 0))
  const s = Math.sin(-(cam.rot ?? 0))
  const dx = sx - CX - (cam.dx ?? 0)
  const dy = sy - CY - (cam.dy ?? 0)
  return [cam.x + (dx * c - dy * s) / cam.zoom, cam.y + (dx * s + dy * c) / cam.zoom]
}

/**
 * Camera that frames world point `p` at screen point `at` with the given zoom.
 * Handy for composing shots: "put this card at (1250, 560), 2× zoom".
 */
export function frame(p, zoom, at = [CX, CY], rot = 0) {
  return { x: p[0] - (at[0] - CX) / zoom, y: p[1] - (at[1] - CY) / zoom, zoom, rot }
}

/**
 * Interpolate between two cameras. Zoom is interpolated in log space, and the
 * position so the zoom target travels in a straight line on screen (no
 * overshoot out of frame when zooming in or out).
 */
export function blendCamera(a, b, e) {
  const za = Math.log(a.zoom)
  const zb = Math.log(b.zoom)
  const zoom = Math.exp(lerp(za, zb, e))
  let x
  let y
  if (Math.abs(zb - za) < 1e-4) {
    x = lerp(a.x, b.x, e)
    y = lerp(a.y, b.y, e)
  } else if (b.zoom > a.zoom) {
    const k = (a.zoom * (1 - e)) / zoom
    x = b.x - (b.x - a.x) * k
    y = b.y - (b.y - a.y) * k
  } else {
    const k = (b.zoom * e) / zoom
    x = a.x + (b.x - a.x) * k
    y = a.y + (b.y - a.y) * k
  }
  return { x, y, zoom, rot: lerp(a.rot ?? 0, b.rot ?? 0, e) }
}

/**
 * Keyframed camera. keys: [{ t, cam, ease }] sorted by t; `ease` shapes the
 * move that arrives at that key (default: inOutCubic).
 */
export function cameraAt(keys, t) {
  if (t <= keys[0].t) return { ...keys[0].cam }
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]
    if (t <= k.t) {
      const p = keys[i - 1]
      const u = clamp((t - p.t) / Math.max(1e-6, k.t - p.t))
      return blendCamera(p.cam, k.cam, (k.ease ?? inOutCubic)(u))
    }
  }
  return { ...keys[keys.length - 1].cam }
}

/** Kick-driven camera shake: a small, fast-decaying jolt on each hit. */
export function shake(T, t, amount = 1, voice = 'kick', seed = 5) {
  const p = T.pulse(t, voice, 14) * amount
  if (p <= 1e-3) return { dx: 0, dy: 0, rot: 0 }
  return {
    dx: fbm1(t * 37, seed) * 9 * p,
    dy: fbm1(t * 41, seed + 7) * 7 * p,
    rot: fbm1(t * 29, seed + 13) * 0.0035 * p,
  }
}

export const EASE = {
  move: inOutCubic,
  settle: M3.emphasized,
  enter: M3.enter,
  /** Whip pan: slow out, very fast middle, slow in. */
  whip: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
}
