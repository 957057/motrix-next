/** Canvas drawing primitives shared by scenes and UI mock-ups. */
import { clamp, rgba, TAU } from './math.js'

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)))
}

export function fillRR(ctx, x, y, w, h, r, fill) {
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

export function strokeRR(ctx, x, y, w, h, r, stroke, width = 1) {
  rr(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

/** Soft radial light. Use with 'lighter' for additive glow. */
export function glow(ctx, x, y, r, color, alpha = 1, falloff = [0, 0.35, 1]) {
  if (r <= 0 || alpha <= 0) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(falloff[0], rgba(color, alpha))
  g.addColorStop(falloff[1], rgba(color, alpha * 0.35))
  g.addColorStop(falloff[2], rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Elliptical glow, e.g. an anamorphic lens streak. */
export function streak(ctx, x, y, rx, ry, color, alpha = 1, angle = 0) {
  if (alpha <= 0) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(1, ry / rx)
  glow(ctx, 0, 0, rx, color, alpha, [0, 0.12, 1])
  ctx.restore()
}

/**
 * Blurred drop shadow under a rounded rectangle. The shape itself is clipped
 * out, so only the shadow is painted: a panel that fades or sits on top at
 * partial opacity never turns into a dark box.
 */
export function shadow(ctx, x, y, w, h, r, blur = 60, alpha = 0.5, dy = 24) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x - 5000, y - 5000, w + 10000, h + 10000)
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)))
  ctx.clip('evenodd')
  ctx.shadowColor = `rgba(0,0,0,${clamp(alpha)})`
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = dy
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()
}

/** Frosted glass panel: tinted fill, top highlight and a thin bright rim. */
export function glass(ctx, x, y, w, h, r, o = {}) {
  const { tint = '#ffffff', alpha = 0.07, rim = 0.28, rimColor = '#ffffff', sheen = 0.1 } = o
  ctx.save()
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = rgba(tint, alpha)
  ctx.fill()
  if (sheen > 0) {
    const g = ctx.createLinearGradient(x, y, x, y + h * 0.6)
    g.addColorStop(0, rgba('#ffffff', sheen))
    g.addColorStop(1, rgba('#ffffff', 0))
    ctx.fillStyle = g
    ctx.fill()
  }
  const s = ctx.createLinearGradient(x, y, x + w * 0.3, y + h)
  s.addColorStop(0, rgba(rimColor, rim))
  s.addColorStop(0.5, rgba(rimColor, rim * 0.25))
  s.addColorStop(1, rgba(rimColor, rim * 0.6))
  ctx.strokeStyle = s
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

export function circle(ctx, x, y, r, fill) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, TAU)
  ctx.fillStyle = fill
  ctx.fill()
}

export function ring(ctx, x, y, r, stroke, width = 2) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, TAU)
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

/** Stroke a polyline up to a fraction of its length. */
export function tracePath(ctx, pts, progress, closed = false) {
  const p = clamp(progress)
  if (p <= 0) return
  const seq = closed ? [...pts, pts[0]] : pts
  let total = 0
  const lens = []
  for (let i = 1; i < seq.length; i++) {
    const l = Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1])
    lens.push(l)
    total += l
  }
  let remain = total * p
  ctx.beginPath()
  ctx.moveTo(seq[0][0], seq[0][1])
  for (let i = 1; i < seq.length; i++) {
    const l = lens[i - 1]
    if (remain >= l) {
      ctx.lineTo(seq[i][0], seq[i][1])
      remain -= l
    } else {
      const k = l > 0 ? remain / l : 0
      ctx.lineTo(seq[i - 1][0] + (seq[i][0] - seq[i - 1][0]) * k, seq[i - 1][1] + (seq[i][1] - seq[i - 1][1]) * k)
      break
    }
  }
  ctx.stroke()
}

/** Position at a fraction of a polyline's length. */
export function pointOnPath(pts, progress, closed = false) {
  const seq = closed ? [...pts, pts[0]] : pts
  let total = 0
  for (let i = 1; i < seq.length; i++) total += Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1])
  let remain = total * clamp(progress)
  for (let i = 1; i < seq.length; i++) {
    const l = Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1])
    if (remain <= l) {
      const k = l > 0 ? remain / l : 0
      return [seq[i - 1][0] + (seq[i][0] - seq[i - 1][0]) * k, seq[i - 1][1] + (seq[i][1] - seq[i - 1][1]) * k]
    }
    remain -= l
  }
  return seq[seq.length - 1]
}

/** Material-style switch. */
export function toggle(ctx, x, y, on, colors) {
  const w = 44
  const h = 24
  fillRR(ctx, x, y, w, h, h / 2, on ? colors.on : colors.off)
  circle(ctx, x + (on ? w - h / 2 : h / 2), y + h / 2, 8, on ? colors.knobOn : colors.knobOff)
}

/** Run fn with a temporary alpha multiplier and composite mode. */
export function layer(ctx, alpha, fn, composite) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha *= clamp(alpha)
  if (composite) ctx.globalCompositeOperation = composite
  fn()
  ctx.restore()
}
