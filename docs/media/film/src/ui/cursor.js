/** Mouse cursor, click ripple and keyframed cursor paths (screen or world space). */
import { ring } from '../core/draw.js'
import { inOutCubic } from '../core/ease.js'
import { clamp, lerp, rgba } from '../core/math.js'

/** keys: [[t, [x, y]], …] sorted by t. */
export function cursorAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1]
      const [t1, b] = keys[i]
      const u = inOutCubic(clamp((t - t0) / Math.max(1e-6, t1 - t0)))
      return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]
    }
  }
  return keys[keys.length - 1][1]
}

/** Press amount for a click at `at` (quick dip and release). */
export function press(t, at) {
  return Math.sin(Math.PI * clamp((t - at) / 0.18))
}

export function drawCursor(ctx, x, y, alpha, pressed = 0, size = 1.25) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha *= clamp(alpha)
  ctx.translate(x, y)
  const s = size * (1 - 0.12 * pressed)
  ctx.scale(s, s)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 24)
  ctx.lineTo(6.5, 18.5)
  ctx.lineTo(11, 28)
  ctx.lineTo(15, 26)
  ctx.lineTo(10.5, 16.8)
  ctx.lineTo(18.5, 16.5)
  ctx.closePath()
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.shadowColor = 'rgba(0,0,0,0)'
  ctx.strokeStyle = '#141222'
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

export function clickRipple(ctx, x, y, age, scale = 1) {
  if (age < 0 || age > 0.5) return
  const k = age / 0.5
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ring(ctx, x, y, (12 + 40 * k) * scale, rgba('#E9DDFF', 0.7 * (1 - k)), 2.5 * scale)
  ctx.restore()
}
