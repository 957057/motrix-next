/**
 * 2.5D panels: draw vector UI as a plane in perspective.
 *
 * The UI is painted into an offscreen layer, then mapped onto the projected
 * quad as a grid of small affine cells (piecewise-linear perspective). Pure
 * Canvas2D, so it is deterministic and renders the same in every backend.
 *
 * Rule: tilt while moving, land flat before anything has to be read. When
 * both tilts are ~0 the paint callback draws straight into the frame as
 * vectors, with no resampling at all.
 */
import { clamp } from './math.js'

const FLAT = 1e-3
let makeLayer = null
const layers = []
let depth = 0

/** Install an offscreen canvas factory: (w, h) => canvas. Without one, tilted planes fall back to an affine approximation. */
export function setLayerFactory(fn) {
  makeLayer = fn
}

function layer(w, h) {
  // One layer per nesting level, reused across calls and resized on demand.
  let L = layers[depth]
  if (!L) {
    const canvas = makeLayer(w, h)
    L = { canvas, ctx: canvas.getContext('2d') }
    layers[depth] = L
  }
  if (L.canvas.width < w || L.canvas.height < h) {
    L.canvas.width = Math.max(L.canvas.width, w)
    L.canvas.height = Math.max(L.canvas.height, h)
  }
  return L
}

/**
 * Project a local point (u, v) of plane `o` into the current user space.
 * o: { x, y, w, h, scale, rx, ry, rz, z, persp }
 *   (x, y)  screen position of the plane centre
 *   w, h    local size; scale = user px per local px at depth 0
 *   rx      tilt about the horizontal axis (+ = top edge recedes)
 *   ry      turn about the vertical axis (+ = right edge recedes)
 *   rz      in-plane rotation; z = depth offset (+ = away)
 */
export function projectPlane(o, u, v) {
  const { x, y, w, h, scale = 1, rx = 0, ry = 0, rz = 0, z = 0, persp = 2200 } = o
  let X = (u - w / 2) * scale
  let Y = (v - h / 2) * scale
  let Z = 0
  if (rz) {
    const c = Math.cos(rz)
    const s = Math.sin(rz)
    ;[X, Y] = [X * c - Y * s, X * s + Y * c]
  }
  if (rx) {
    const c = Math.cos(rx)
    const s = Math.sin(rx)
    ;[Y, Z] = [Y * c + Z * s, -Y * s + Z * c]
  }
  if (ry) {
    const c = Math.cos(ry)
    const s = Math.sin(ry)
    ;[X, Z] = [X * c - Z * s, X * s + Z * c]
  }
  Z += z
  const k = persp / Math.max(1, persp + Z)
  return [x + X * k, y + Y * k]
}

function flat(o) {
  return Math.abs(o.rx ?? 0) < FLAT && Math.abs(o.ry ?? 0) < FLAT
}

function deviceScale(ctx) {
  const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null
  if (!m || !Number.isFinite(m.a)) return 1
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1
}

function quadShadow(ctx, pts, alpha, blur) {
  ctx.save()
  ctx.shadowColor = `rgba(0,0,0,${clamp(alpha)})`
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = blur * 0.35
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()
}

/**
 * Draw `paint(ctx)` (which draws in local 0..w × 0..h space) as a plane.
 * Extra options: alpha, shadow (0..1), radius (corner radius for the shadow in local px).
 */
export function drawPlane(ctx, o, paint) {
  const alpha = clamp(o.alpha ?? 1)
  if (alpha <= 0) return
  const { w, h } = o
  ctx.save()
  ctx.globalAlpha *= alpha

  if (flat(o)) {
    const k = (o.scale ?? 1) * ((o.persp ?? 2200) / Math.max(1, (o.persp ?? 2200) + (o.z ?? 0)))
    ctx.translate(o.x, o.y)
    if (o.rz) ctx.rotate(o.rz)
    ctx.scale(k, k)
    ctx.translate(-w / 2, -h / 2)
    if (o.shadow) {
      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${clamp(o.shadow)})`
      ctx.shadowBlur = 70
      ctx.shadowOffsetY = 28
      ctx.beginPath()
      ctx.roundRect(0, 0, w, h, o.radius ?? 12)
      ctx.fillStyle = '#000'
      ctx.fill()
      ctx.restore()
    }
    paint(ctx)
    ctx.restore()
    return
  }

  const P = (u, v) => projectPlane(o, u, v)
  const corners = [P(0, 0), P(w, 0), P(w, h), P(0, h)]
  if (o.shadow) quadShadow(ctx, corners, o.shadow, 80)

  if (!makeLayer) {
    // Affine approximation from three corners (smoke tests, QA without layers).
    const [a, b, , d] = corners
    ctx.transform((b[0] - a[0]) / w, (b[1] - a[1]) / w, (d[0] - a[0]) / h, (d[1] - a[1]) / h, a[0], a[1])
    paint(ctx)
    ctx.restore()
    return
  }

  // Raster resolution: enough for the largest on-screen magnification.
  const edge = Math.max(
    Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]) / w,
    Math.hypot(corners[2][0] - corners[3][0], corners[2][1] - corners[3][1]) / w,
    Math.hypot(corners[3][0] - corners[0][0], corners[3][1] - corners[0][1]) / h,
    Math.hypot(corners[2][0] - corners[1][0], corners[2][1] - corners[1][1]) / h,
  )
  const ss = clamp(edge * deviceScale(ctx), 0.5, 3)
  const lw = Math.ceil(w * ss)
  const lh = Math.ceil(h * ss)
  const L = layer(lw, lh)
  depth++
  try {
    L.ctx.setTransform(1, 0, 0, 1, 0, 0)
    L.ctx.globalAlpha = 1
    L.ctx.globalCompositeOperation = 'source-over'
    L.ctx.clearRect(0, 0, lw + 2, lh + 2)
    L.ctx.setTransform(ss, 0, 0, ss, 0, 0)
    paint(L.ctx)
  } finally {
    depth--
  }

  // Cell grid: denser along the axis that is turned.
  const cols = Math.min(
    48,
    Math.max(2, Math.ceil(4 + 60 * Math.abs(Math.sin(o.ry ?? 0)) + 12 * Math.abs(Math.sin(o.rx ?? 0)))),
  )
  const rows = Math.min(
    40,
    Math.max(2, Math.ceil(3 + 48 * Math.abs(Math.sin(o.rx ?? 0)) + 8 * Math.abs(Math.sin(o.ry ?? 0)))),
  )
  const cw = w / cols
  const ch = h / rows
  // Overlap neighbouring cells slightly so antialiased seams never open.
  const ov = 1.2 / Math.max(0.25, edge)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = i * cw
      const v0 = j * ch
      const p00 = P(u0, v0)
      const p10 = P(u0 + cw, v0)
      const p01 = P(u0, v0 + ch)
      const sw = Math.min(cw + ov, w - u0)
      const sh = Math.min(ch + ov, h - v0)
      ctx.save()
      ctx.transform(
        (p10[0] - p00[0]) / cw,
        (p10[1] - p00[1]) / cw,
        (p01[0] - p00[0]) / ch,
        (p01[1] - p00[1]) / ch,
        p00[0],
        p00[1],
      )
      ctx.drawImage(L.canvas, u0 * ss, v0 * ss, sw * ss, sh * ss, 0, 0, sw, sh)
      ctx.restore()
    }
  }
  ctx.restore()
}
