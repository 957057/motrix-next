/**
 * Rayburst "New Task" dialog (components/task/AddTask.vue): an NCard modal
 * min(680px, 70vw) wide and 82vh tall, URL / Torrent tabs, the five-row URL
 * textarea ("one task URL per line"), the always-visible download settings
 * (Rename, Connections = 64 by default, Save to, Advanced Options) and the
 * segmented Cancel / Create footer. Drawn in window-local coordinates.
 */
import { circle, fillRR, rr, shadow, strokeRR } from '../core/draw.js'
import { M3 } from '../core/ease.js'
import { icon } from '../core/icons.js'
import { clamp, rgba } from '../core/math.js'
import { ellipsize, measure, text } from '../core/text.js'
import { WIN } from './appwindow.js'

export const DIALOG = { x: 300, y: 72, w: 680, h: 656 }
export const TEXTAREA = { x: DIALOG.x + 24, y: DIALOG.y + 113, w: DIALOG.w - 48, h: 138 }
const LINE_H = 22.4
const FOOT_Y = DIALOG.y + DIALOG.h - 66

/** Baseline of textarea line i (local window coordinates). */
export function lineBaseline(i) {
  return TEXTAREA.y + 12 + 16 + i * LINE_H
}

function buttonWidths(ctx, s) {
  const o = { size: 14, weight: 500 }
  return {
    create: Math.max(64, measure(ctx, s('ui.create'), o) + 36),
    cancel: Math.max(64, measure(ctx, s('ui.cancel'), o) + 36),
  }
}

/** Centre of the Create button (window-local). */
export function createPoint(ctx, s) {
  const { create } = buttonWidths(ctx, s)
  return [DIALOG.x + DIALOG.w - 24 - create / 2, FOOT_Y + 16 + 17]
}

function input(ctx, th, x, y, w, h, value, placeholder) {
  fillRR(ctx, x, y, w, h, 6, th.containerHighest)
  strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6, th.outlineVariant, 1)
  if (value) text(ctx, value, x + 12, y + h / 2 + 5, { size: 14, color: th.text })
  else if (placeholder) text(ctx, placeholder, x + 12, y + h / 2 + 5, { size: 14, color: th.outline })
}

/**
 * st: {
 *   open 0..1, leave 0..1,
 *   lines: [{ text, k (0..1 arrival), flash (0..1) }],
 *   caret (bool), press 0..1 (Create), hover 0..1 (Create)
 * }
 */
export function drawAddTask(ctx, th, S, st) {
  const open = clamp(st.open ?? 1)
  const leave = clamp(st.leave ?? 0)
  if (open <= 0 || leave >= 1) return
  const s = S.s
  const { x, y, w, h } = DIALOG

  // Modal mask over the whole window.
  ctx.fillStyle = rgba('#000000', 0.55 * open * (1 - M3.exit(leave)))
  ctx.fillRect(0, 0, WIN.w, WIN.h)

  const le = M3.exit(leave)
  ctx.save()
  ctx.globalAlpha *= open * (1 - le)
  const sc = 1 - 0.08 * le
  ctx.translate(x + w / 2, y + h / 2)
  ctx.scale(sc, sc)
  ctx.translate(-(x + w / 2), -(y + h / 2))

  shadow(ctx, x, y, w, h, 10, 60, th.shadow, 18)
  fillRR(ctx, x, y, w, h, 10, th.containerHigh)
  strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10, th.outlineVariant, 1)

  // Header
  text(ctx, s('ui.newTask'), x + 24, y + 40, { size: 18, weight: 600, color: th.text })
  icon(ctx, 'close', x + w - 24 - 18, y + 25, 18, th.outline, 1.6)

  // Tabs (type="line")
  const ty = y + 62
  const tabO = { size: 14, weight: 500 }
  const t1 = measure(ctx, s('ui.tabUri'), tabO)
  text(ctx, s('ui.tabUri'), x + 24, ty + 22, { ...tabO, color: th.primary })
  text(ctx, s('ui.tabTorrent'), x + 24 + t1 + 32, ty + 22, { ...tabO, color: th.textDim })
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(x + 24, ty + 35, w - 48, 1)
  fillRR(ctx, x + 24, ty + 33, t1, 2, 1, th.primary)

  // URL textarea (focused)
  const ta = TEXTAREA
  fillRR(ctx, ta.x, ta.y, ta.w, ta.h, 6, th.containerHighest)
  strokeRR(ctx, ta.x + 0.5, ta.y + 0.5, ta.w - 1, ta.h - 1, 6, th.primary, 1)
  ctx.save()
  rr(ctx, ta.x - 3, ta.y - 3, ta.w + 6, ta.h + 6, 8)
  ctx.strokeStyle = rgba(th.primary, 0.2)
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
  const lines = (st.lines ?? []).filter((l) => (l.k ?? 1) > 0)
  const lineO = { size: 14, color: th.text }
  if (!lines.length) {
    text(ctx, s('ui.uriTips'), ta.x + 12, lineBaseline(0), { size: 14, color: th.outline })
  }
  let caretX = ta.x + 12
  let caretI = 0
  ctx.save()
  rr(ctx, ta.x, ta.y, ta.w, ta.h, 6)
  ctx.clip()
  lines.forEach((l, i) => {
    const by = lineBaseline(i)
    if (l.flash > 0) fillRR(ctx, ta.x + 6, by - 16, ta.w - 12, 22, 4, rgba(th.primary, 0.22 * l.flash))
    const str = ellipsize(ctx, l.text, ta.w - 24, lineO)
    const k = clamp(l.k ?? 1)
    // Characters settle in from the left edge as the link lands.
    const shown = k >= 1 ? str : [...str].slice(0, Math.ceil([...str].length * M3.enter(k))).join('')
    const wdt = text(ctx, shown, ta.x + 12, by, lineO)
    caretX = ta.x + 12 + wdt + 1
    caretI = i
  })
  ctx.restore()
  if (st.caret && Math.sin(S.t * Math.PI * 2 * 1.1) > -0.2) {
    ctx.fillStyle = th.text
    ctx.fillRect(caretX, lineBaseline(caretI) - 14, 1.2, 18)
  }

  // Download settings (label-placement left, 110px labels)
  const fx = x + 24
  const iw = w - 48 - 110
  const labelO = { size: 14, color: th.text }
  const row = (i) => DIALOG.y + 113 + 150 + 4 + i * 58
  text(ctx, `${s('ui.rename')}:`, fx, row(0) + 22, labelO)
  input(ctx, th, fx + 110, row(0), iw, 34, '', s('ui.optional'))
  text(ctx, `${s('ui.conns')}:`, fx, row(1) + 22, labelO)
  input(ctx, th, fx + 110, row(1), 120, 34, '64', '')
  icon(ctx, 'minimize', fx + 110 + 120 - 56, row(1) + 10, 14, th.outline, 1.6)
  icon(ctx, 'plus', fx + 110 + 120 - 28, row(1) + 10, 14, th.outline, 1.6)
  text(ctx, `${s('ui.saveTo')}:`, fx, row(2) + 22, labelO)
  input(ctx, th, fx + 110, row(2), iw - 76, 34, '~/Downloads', '')
  fillRR(ctx, fx + 110 + iw - 72, row(2), 34, 34, 6, th.containerHighest)
  strokeRR(ctx, fx + 110 + iw - 71.5, row(2) + 0.5, 33, 33, 6, th.outlineVariant, 1)
  icon(ctx, 'folderOpen', fx + 110 + iw - 64, row(2) + 8, 18, th.textDim, 1.5)
  fillRR(ctx, fx + 110 + iw - 34, row(2), 34, 34, 6, th.containerHighest)
  strokeRR(ctx, fx + 110 + iw - 33.5, row(2) + 0.5, 33, 33, 6, th.outlineVariant, 1)
  icon(ctx, 'chevron', fx + 110 + iw - 25, row(2) + 10, 15, th.textDim, 1.5)
  icon(ctx, 'chevronRight', fx, row(3) + 8, 14, th.textDim, 1.6)
  text(ctx, s('ui.advanced'), fx + 20, row(3) + 20, { size: 14, color: th.textDim })

  // Footer
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(x, FOOT_Y, w, 1)
  const bw = buttonWidths(ctx, s)
  const by = FOOT_Y + 16
  const cx = x + w - 24 - bw.create
  const press = clamp(st.press ?? 0)
  const hover = clamp(st.hover ?? 0)
  ctx.save()
  const ps = 1 - 0.05 * Math.sin(Math.PI * press)
  ctx.translate(cx + bw.create / 2, by + 17)
  ctx.scale(ps, ps)
  ctx.translate(-(cx + bw.create / 2), -(by + 17))
  fillRR(ctx, cx, by, bw.create, 34, 6, th.primary)
  if (hover > 0) fillRR(ctx, cx, by, bw.create, 34, 6, rgba('#ffffff', 0.12 * hover))
  if (press > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    circle(ctx, cx + bw.create / 2, by + 17, 12 + 60 * press, rgba(th.primary, 0.3 * (1 - press)))
    ctx.restore()
  }
  text(ctx, s('ui.create'), cx + bw.create / 2, by + 22, {
    size: 14,
    weight: 500,
    color: th.onPrimary,
    align: 'center',
  })
  ctx.restore()
  const kx = cx - 12 - bw.cancel
  strokeRR(ctx, kx + 0.5, by + 0.5, bw.cancel - 1, 33, 6, th.outline, 1)
  text(ctx, s('ui.cancel'), kx + bw.cancel / 2, by + 22, { size: 14, weight: 500, color: th.text, align: 'center' })
  ctx.restore()
}
