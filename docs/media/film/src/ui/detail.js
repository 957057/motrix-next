/**
 * Task detail drawer (components/task/TaskDetail.vue): an NDrawer from the
 * right, 61.8% of the window wide, with the icon tab row and the Activity tab
 * (detail/TaskDetailActivity.vue): the TaskGraphic piece map followed by the
 * bordered description table.
 *
 * TaskGraphic draws 8×8 atoms with 2px gutters, one atom per bitfield hex
 * digit, coloured on a 5-step ramp from surface-container to status-success
 * (status = floor(hex / 4), so a full atom is the 75% step); newly activated
 * atoms get a brief success glow.
 */
import { fillRR, glow, rr, strokeRR } from '../core/draw.js'
import { M3 } from '../core/ease.js'
import { icon } from '../core/icons.js'
import { clamp, mix, rgba } from '../core/math.js'
import { measure, text } from '../core/text.js'
import { WIN } from './appwindow.js'

export const DRAWER = { x: WIN.w * (1 - 0.618), w: WIN.w * 0.618 }
const PAD = 24
export const GRAPHIC = { x: DRAWER.x + PAD, y: 136, w: DRAWER.w - PAD * 2 }
const ATOM = 8
const GUTTER = 2
export const COLS = Math.floor((GRAPHIC.w - ATOM) / (ATOM + GUTTER)) + 1

export function graphicHeight(atoms) {
  const rows = Math.ceil(atoms / COLS)
  return (ATOM + GUTTER) * (rows - 1) + ATOM
}

const TABS = [
  ['info', 'ui.tab.general'],
  ['pulse', 'ui.tab.activity'],
  ['document', 'ui.tab.files'],
  ['people', 'ui.tab.peers'],
  ['server', 'ui.tab.trackers'],
]

/**
 * st: {
 *   p: 0..1 slide-in, out: 0..1 slide-out,
 *   atoms: count, level(i) → 0..3, fresh(i) → 0..1,
 *   rows: [[label, value]], progress: 0..1
 * }
 */
export function drawDetailDrawer(ctx, th, S, st) {
  const p = M3.enter(clamp(st.p ?? 1)) * (1 - M3.exit(clamp(st.out ?? 0)))
  if (p <= 0) return
  const s = S.s
  ctx.fillStyle = rgba('#000000', 0.45 * p)
  ctx.fillRect(0, 0, WIN.w, WIN.h)

  ctx.save()
  ctx.translate((1 - p) * DRAWER.w, 0)
  const x = DRAWER.x
  const g = ctx.createLinearGradient(x - 40, 0, x, 0)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${0.35 * p})`)
  ctx.fillStyle = g
  ctx.fillRect(x - 40, 0, 40, WIN.h)
  ctx.fillStyle = th.containerHigh
  ctx.fillRect(x, 0, DRAWER.w, WIN.h)
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(x, 0, 1, WIN.h)

  // Header
  text(ctx, s('ui.detail'), x + PAD, 38, { size: 16, weight: 600, color: th.text })
  icon(ctx, 'close', x + DRAWER.w - PAD - 16, 24, 16, th.outline, 1.6)
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(x, 60, DRAWER.w, 1)

  // Tabs: icon + 12px label, 36px tall, active = on-surface with a primary underline
  let tx = x + PAD
  TABS.forEach(([ic, key], i) => {
    const label = s(key)
    const lw = measure(ctx, label, { size: 12 })
    const bw = 12 + 16 + 5 + lw + 12
    const on = i === 1
    const col = on ? th.text : th.textDim
    icon(ctx, ic, tx + 12, 86, 16, col, 1.6)
    text(ctx, label, tx + 12 + 16 + 5, 98, { size: 12, color: col })
    if (on) fillRR(ctx, tx, 110, bw, 2, 1, th.primary)
    tx += bw + 2
  })
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(x + PAD, 112, DRAWER.w - PAD * 2, 1)

  // TaskGraphic
  const ramp = [0, 0.25, 0.5, 0.75, 1].map((k) => mix(th.container, th.success, k))
  const base = ctx.globalAlpha
  const fresh = []
  for (let i = 0; i < st.atoms; i++) {
    const ax = GRAPHIC.x + (i % COLS) * (ATOM + GUTTER)
    const ay = GRAPHIC.y + Math.floor(i / COLS) * (ATOM + GUTTER)
    const lv = st.level(i)
    ctx.globalAlpha = base * (lv > 0 ? 1 : 0.5)
    rr(ctx, ax, ay, ATOM, ATOM, 1.5)
    ctx.fillStyle = ramp[lv]
    ctx.fill()
    ctx.globalAlpha = base * (lv > 0 ? 0.6 : 0.3)
    ctx.strokeStyle = th.outlineVariant
    ctx.lineWidth = 0.5
    ctx.stroke()
    const fr = st.fresh(i)
    if (fr > 0) {
      ctx.globalAlpha = base * (0.3 + 0.5 * fr)
      ctx.fillStyle = th.success
      ctx.fill()
      fresh.push([ax + ATOM / 2, ay + ATOM / 2, fr])
    }
  }
  ctx.globalAlpha = base
  // A soft light where pieces just landed (film lighting, not UI).
  if (fresh.length) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const [fx, fy, fr] of fresh) glow(ctx, fx, fy, 16, th.success, 0.22 * fr)
    ctx.restore()
  }

  // Descriptions (bordered, label-left, small)
  const top = GRAPHIC.y + graphicHeight(st.atoms) + 8 + 12
  const rows = st.rows ?? []
  const rh = 36
  const labelW = Math.max(...rows.map(([l]) => measure(ctx, l, { size: 13 }))) + 24
  const tw = DRAWER.w - PAD * 2
  ctx.save()
  rr(ctx, x + PAD, top, tw, rh * rows.length, 4)
  ctx.clip()
  ctx.fillStyle = rgba(th.text, 0.05)
  ctx.fillRect(x + PAD, top, labelW, rh * rows.length)
  ctx.restore()
  strokeRR(ctx, x + PAD + 0.5, top + 0.5, tw - 1, rh * rows.length - 1, 4, th.outlineVariant, 1)
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(x + PAD + labelW, top, 1, rh * rows.length)
  rows.forEach(([label, value], i) => {
    const ry = top + i * rh
    if (i > 0) {
      ctx.fillStyle = th.outlineVariant
      ctx.fillRect(x + PAD, ry, tw, 1)
    }
    text(ctx, label, x + PAD + 12, ry + 23, { size: 13, color: th.textDim })
    const vx = x + PAD + labelW + 12
    if (value === '__progress__') {
      const pw = tw - labelW - 24 - 52
      fillRR(ctx, vx, ry + 13, pw, 10, 5, th.rail)
      fillRR(ctx, vx, ry + 13, Math.max(10, pw * clamp(st.progress)), 10, 5, th.primary)
      text(ctx, `${Math.floor(clamp(st.progress) * 100)}%`, vx + pw + 10, ry + 23, { size: 13, color: th.text })
    } else {
      text(ctx, value, vx, ry + 23, { size: 13, color: th.text })
    }
  })
  ctx.restore()
}

/** Window-local centre of an atom (for camera framing). */
export function atomPoint(i) {
  return [
    GRAPHIC.x + (i % COLS) * (ATOM + GUTTER) + ATOM / 2,
    GRAPHIC.y + Math.floor(i / COLS) * (ATOM + GUTTER) + ATOM / 2,
  ]
}
