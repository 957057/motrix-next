/**
 * Glass browser window with a video page and the Rayburst Connect popup,
 * rebuilt from rayburst-connect/entrypoints/popup:
 *   PopupHeader  logo · Connected badge · Intercepting switch · settings
 *   NTabs        Downloads · Sniffer (+ resource count)
 *   MediaPanel   Current page select · discover switch · media tools;
 *                filter / type / sort row; resource rows (checkbox, name,
 *                kind, copy · inspect · preview · download); footer tools and
 *                the batch Download button
 *   MediaSelection (after a row's download): Back to sources, AES-128 key /
 *                manifest button, name, kind, probing spinner, then Video
 *                quality · Audio · Subtitles · Output format · Start · End and
 *                Cancel / Download; a success alert once submitted.
 * Local space 1040×810, scaled into any rect.
 */
import { C } from '../brand/palette.js'
import { drawLogo } from '../brand/logo.js'
import { circle, fillRR, glass, glow, rr, shadow, strokeRR } from '../core/draw.js'
import { M3, spring } from '../core/ease.js'
import { icon } from '../core/icons.js'
import { clamp, hash2, lerp, rgba } from '../core/math.js'
import { ellipsize, measure, text } from '../core/text.js'

export const BROWSER = { w: 1040, h: 810 }
export const POPUP = { x: 604, y: 60, w: 420 }
export const EXT_ICON = [902, 32]
const LIST_Y = 182
const ROW_H = 56
const VIEW_Y = 142
const ITEM_Y = 250
const ITEM_H = 52

const PX = {
  bg: '#16151D',
  surface: '#201E28',
  surfaceHi: '#2A2833',
  text: '#ECE6F4',
  dim: '#C9C1D6',
  faint: '#948CA3',
  outline: '#3D3A47',
  primary: '#D6BAFF',
  onPrimary: '#3F1873',
  success: '#9EF6B0',
  successBg: '#0F3D22',
}

export const ROWS = [
  { name: 'aurora-fjord-4k.m3u8', kind: 'hls', actions: ['copy', 'list', 'playCircle', 'download'] },
  { name: 'aurora-preview.mp4', kind: 'file', size: '12.4 MB', actions: ['copy', 'playCircle', 'download'] },
  { name: 'aurora-fjord.en.vtt', kind: 'subs', size: '18 KB', actions: ['copy', 'download'] },
]

const FORMATS = ['MP4', 'MKV']

/** Popup height: catalog → media form → compact once submitted (the form is only rendered while ready). */
export function popupHeight(view, done = 0) {
  const catalog = LIST_Y + 3 * ROW_H + 60
  const selection = ITEM_Y + 6 * ITEM_H + 58
  const compact = VIEW_Y + 92 + 34 + 20
  return lerp(lerp(catalog, selection, M3.standard(clamp(view))), compact, M3.standard(clamp(done)))
}

/** Browser-local centre of the "Download created in Rayburst." alert. */
export function alertPoint() {
  return [POPUP.x + POPUP.w / 2, POPUP.y + VIEW_Y + 92 + 17]
}

/** Popup-local item top for the media form (i = 0..5). */
function itemTop(i) {
  return ITEM_Y + i * ITEM_H
}

/** Browser-local cursor targets. */
export function popupTargets() {
  const px = POPUP.x
  const py = POPUP.y
  const rowActions = (row, name) => {
    const k = ROWS[row].actions.length - 1 - ROWS[row].actions.indexOf(name)
    return [px + POPUP.w - 16 - 14 - k * 30, py + LIST_Y + row * ROW_H + ROW_H / 2]
  }
  const selH = popupHeight(1)
  return {
    ext: EXT_ICON,
    rowDownload: rowActions(0, 'download'),
    format: [px + 16 + 160, py + itemTop(3) + 18 + 14],
    mkv: [px + 16 + 80, py + itemTop(3) + 18 + 28 + 6 + 4 + 32 + 16],
    download: [px + POPUP.w - 16 - 44, py + selH - 58 + 12 + 14],
  }
}

export function browserPoint(rect, [lx, ly]) {
  const k = rect.w / BROWSER.w
  return [rect.x + lx * k, rect.y + ly * k]
}

/** Procedural aurora borealis over a fjord. */
export function drawAurora(ctx, x, y, w, h, t, seed = 1) {
  ctx.save()
  rr(ctx, x, y, w, h, 14)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, y, 0, y + h)
  sky.addColorStop(0, '#02030C')
  sky.addColorStop(0.6, '#081631')
  sky.addColorStop(1, '#0C1D38')
  ctx.fillStyle = sky
  ctx.fillRect(x, y, w, h)
  for (let i = 0; i < 70; i++) {
    const sx = x + hash2(seed, i) * w
    const sy = y + hash2(seed + 1, i) * h * 0.6
    const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 + i))
    circle(ctx, sx, sy, 0.6 + hash2(seed + 2, i) * 1.1, rgba('#FFFFFF', a * 0.7))
  }
  ctx.globalCompositeOperation = 'lighter'
  const strips = Math.ceil(w / 5)
  for (let b = 0; b < 3; b++) {
    for (let i = 0; i < strips; i++) {
      const u = i / strips
      const sx = x + u * w
      const base =
        y +
        h * (0.42 + 0.06 * b) +
        Math.sin(u * 5.5 + t * 0.35 + b * 1.7) * h * 0.08 +
        Math.sin(u * 13 + t * 0.9 + b) * h * 0.02
      const height = h * (0.22 + 0.16 * (0.5 + 0.5 * Math.sin(u * 9 + t * 0.6 + b * 2.1)))
      const a = 0.16 * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(u * 21 + t * 1.3 + b * 4)))
      const g = ctx.createLinearGradient(0, base, 0, base - height)
      g.addColorStop(0, rgba(b === 1 ? '#7CF2C0' : '#5CFFB0', a * 1.2))
      g.addColorStop(0.45, rgba('#6BD6D0', a * 0.6))
      g.addColorStop(1, rgba(C.seed, 0))
      ctx.fillStyle = g
      ctx.fillRect(sx, base - height, w / strips + 1, height)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  const ridge = (yy, amp, col, sd) => {
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    for (let i = 0; i <= 40; i++) {
      const u = i / 40
      const n = hash2(sd, i) * 0.6 + hash2(sd, i + 100) * 0.4
      ctx.lineTo(x + u * w, y + h * yy - n * h * amp - Math.sin(u * Math.PI) * h * amp * 0.6)
    }
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    ctx.fillStyle = col
    ctx.fill()
  }
  ridge(0.8, 0.14, '#0A1426', seed + 5)
  ridge(0.86, 0.08, '#050A15', seed + 6)
  const water = ctx.createLinearGradient(0, y + h * 0.86, 0, y + h)
  water.addColorStop(0, 'rgba(92,255,176,0.10)')
  water.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = water
  ctx.fillRect(x, y + h * 0.86, w, h * 0.14)
  ctx.restore()
}

function drawChrome(ctx, S, st) {
  const { w } = BROWSER
  const dots = ['#FF7AB6', '#7AA2FF', '#7FE0FF']
  dots.forEach((c, i) => circle(ctx, 30 + i * 22, 32, 7, c))
  icon(ctx, 'chevronLeft', 98, 22, 20, 'rgba(255,255,255,0.5)', 2)
  icon(ctx, 'chevronRight', 124, 22, 20, 'rgba(255,255,255,0.25)', 2)
  fillRR(ctx, 164, 14, 640, 38, 19, 'rgba(255,255,255,0.07)')
  icon(ctx, 'lock', 180, 23, 18, 'rgba(255,255,255,0.55)', 1.6)
  text(ctx, 'example.com/aurora-4k', 206, 39, { size: 15, color: 'rgba(255,255,255,0.8)' })
  const [ex, ey] = EXT_ICON
  if (st.extGlow > 0) glow(ctx, ex, ey, 44, C.lilac, 0.5 * st.extGlow)
  if (st.extPress > 0) circle(ctx, ex, ey, 20, rgba('#FFFFFF', 0.14 * st.extPress))
  drawLogo(ctx, { x: ex, y: ey, size: 28 })
  if (st.badge > 0) {
    const b = spring(st.badgeAge ?? 1, { freq: 3, damping: 0.45 })
    const r = 9 * clamp(b, 0, 1.3)
    circle(ctx, ex + 12, ey - 11, r, '#E5484D')
    if (r > 5) text(ctx, String(st.badge), ex + 12, ey - 7, { size: 11, weight: 700, color: '#fff', align: 'center' })
  }
  circle(ctx, 966, 32, 14, 'rgba(255,255,255,0.12)')
  icon(ctx, 'more', 998, 20, 22, 'rgba(255,255,255,0.5)', 2.2)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, 64, w, 1)
}

function drawPage(ctx, S) {
  const t = S.t
  drawAurora(ctx, 36, 92, 560, 315, t, 7)
  const prog = 0.23 + ((t * 0.01) % 0.5)
  const cy = 92 + 315 - 26
  const g = ctx.createLinearGradient(0, cy - 40, 0, cy + 26)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = g
  ctx.fillRect(36, cy - 40, 560, 66)
  fillRR(ctx, 56, cy - 6, 520, 4, 2, 'rgba(255,255,255,0.25)')
  fillRR(ctx, 56, cy - 6, 520 * prog, 4, 2, '#FFFFFF')
  circle(ctx, 56 + 520 * prog, cy - 4, 6, '#FFFFFF')
  icon(ctx, 'pause', 56, cy + 4, 16, '#fff', 2)
  const sec = Math.floor(43 + t) % 192
  text(ctx, `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} / 3:12`, 84, cy + 17, {
    size: 12,
    color: 'rgba(255,255,255,0.85)',
  })
  text(ctx, '4K', 560, cy + 17, { size: 11, weight: 700, color: 'rgba(255,255,255,0.8)', align: 'right' })

  text(ctx, S.s('connect.pageTitle'), 36, 450, { size: 24, weight: 700, color: '#F2EEFA' })
  circle(ctx, 52, 488, 16, '#2D5C57')
  glow(ctx, 52, 488, 16, '#5CFFB0', 0.3)
  text(ctx, S.s('connect.channel'), 78, 494, { size: 15, weight: 500, color: 'rgba(255,255,255,0.7)' })
  fillRR(ctx, 36, 530, 560, 12, 6, 'rgba(255,255,255,0.06)')
  fillRR(ctx, 36, 552, 420, 12, 6, 'rgba(255,255,255,0.05)')
  fillRR(ctx, 36, 574, 480, 12, 6, 'rgba(255,255,255,0.04)')
  for (let i = 0; i < 4; i++) {
    const y = 92 + i * 104
    ctx.save()
    ctx.globalAlpha *= 0.55
    drawAurora(ctx, 620, y, 160, 90, t * 0.7 + i * 3, 20 + i)
    ctx.restore()
    fillRR(ctx, 794, y + 10, 200, 12, 6, 'rgba(255,255,255,0.08)')
    fillRR(ctx, 794, y + 32, 150, 10, 5, 'rgba(255,255,255,0.05)')
  }
  for (let i = 0; i < 3; i++) {
    const y = 640 + i * 52
    circle(ctx, 56, y + 14, 16, 'rgba(255,255,255,0.07)')
    fillRR(ctx, 84, y + 4, 300 - i * 40, 10, 5, 'rgba(255,255,255,0.06)')
    fillRR(ctx, 84, y + 20, 420 - i * 60, 10, 5, 'rgba(255,255,255,0.04)')
  }
}

function checkbox(ctx, x, y, on) {
  if (on) {
    fillRR(ctx, x, y, 16, 16, 3, PX.primary)
    icon(ctx, 'check', x + 1, y + 1, 14, PX.onPrimary, 2.4)
  } else {
    strokeRR(ctx, x + 0.75, y + 0.75, 14.5, 14.5, 3, PX.faint, 1.3)
  }
}

function switchSmall(ctx, x, y, on) {
  fillRR(ctx, x, y, 32, 18, 9, on ? PX.primary : PX.outline)
  circle(ctx, x + (on ? 23 : 9), y + 9, 7, on ? PX.onPrimary : PX.dim)
}

function select(ctx, x, y, w, label, o = {}) {
  const h = o.h ?? 28
  fillRR(ctx, x, y, w, h, 6, PX.surfaceHi)
  strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6, o.focus ? PX.primary : PX.outline, 1)
  const lo = { size: 13, color: o.placeholder ? PX.faint : PX.text }
  text(ctx, ellipsize(ctx, label, w - 40, lo), x + 10, y + h / 2 + 4.5, lo)
  icon(ctx, 'chevron', x + w - 24, y + h / 2 - 7, 14, PX.faint, 1.6)
}

function roundBtn(ctx, x, y, ic, color, hot = 0) {
  if (hot > 0) circle(ctx, x, y, 14, rgba('#FFFFFF', 0.12 * hot))
  icon(ctx, ic, x - 9, y - 9, 18, color, 1.6)
}

function button(ctx, x, y, w, label, kind, press = 0) {
  const h = 28
  ctx.save()
  const s = 1 - 0.06 * Math.sin(Math.PI * clamp(press))
  ctx.translate(x + w / 2, y + h / 2)
  ctx.scale(s, s)
  ctx.translate(-(x + w / 2), -(y + h / 2))
  if (kind === 'primary') {
    if (press > 0) glow(ctx, x + w / 2, y + h / 2, 110, PX.primary, 0.4 * Math.sin(Math.PI * press))
    fillRR(ctx, x, y, w, h, 6, PX.primary)
    text(ctx, label, x + w / 2, y + 18.5, { size: 13, weight: 600, color: PX.onPrimary, align: 'center' })
  } else if (kind === 'disabled') {
    fillRR(ctx, x, y, w, h, 6, rgba(PX.primary, 0.3))
    text(ctx, label, x + w / 2, y + 18.5, { size: 13, weight: 600, color: rgba(PX.onPrimary, 0.7), align: 'center' })
  } else if (kind === 'quaternary') {
    text(ctx, label, x + 8, y + 18.5, { size: 12, color: PX.dim })
  } else {
    strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6, PX.outline, 1)
    text(ctx, label, x + w / 2, y + 18.5, { size: 13, color: PX.text, align: 'center' })
  }
  ctx.restore()
}

function drawCatalog(ctx, S, pop, w) {
  const s = S.s
  fillRR(ctx, 16, VIEW_Y, 196, 28, 6, PX.surfaceHi)
  strokeRR(ctx, 16.5, VIEW_Y + 0.5, 195, 27, 6, PX.outline, 1)
  icon(ctx, 'search', 24, VIEW_Y + 6, 16, PX.faint, 1.6)
  text(ctx, s('cx.filter'), 46, VIEW_Y + 18.5, { size: 13, color: PX.faint })
  select(ctx, 220, VIEW_Y, 88, s('cx.all'))
  select(ctx, 316, VIEW_Y, w - 16 - 316, s('cx.time'))

  ROWS.forEach((row, i) => {
    const a = clamp(pop.rows?.[i] ?? 0)
    if (a <= 0) return
    const y = LIST_Y + i * ROW_H
    ctx.save()
    ctx.globalAlpha *= a
    ctx.translate((1 - M3.enter(a)) * 24, 0)
    if (i > 0) {
      ctx.fillStyle = rgba(PX.outline, 0.6)
      ctx.fillRect(16, y, w - 32, 1)
    }
    checkbox(ctx, 16, y + 20, false)
    const meta = row.kind === 'hls' ? 'HLS' : `${s(row.kind === 'file' ? 'cx.fileKind' : 'cx.subsKind')} · ${row.size}`
    const nameO = { size: 13, weight: 600, color: PX.text }
    text(ctx, ellipsize(ctx, row.name, w - 44 - 16 - row.actions.length * 30 - 8, nameO), 44, y + 24, nameO)
    text(ctx, meta, 44, y + 42, { size: 12, color: PX.faint })
    row.actions.forEach((ic, k) => {
      const cx = w - 16 - 14 - (row.actions.length - 1 - k) * 30
      const hot = i === 0 && ic === 'download' ? clamp(pop.rowHot ?? 0) : 0
      roundBtn(ctx, cx, y + ROW_H / 2, ic, ic === 'download' ? PX.primary : PX.dim, hot)
    })
    ctx.restore()
  })

  const fy = LIST_Y + 3 * ROW_H + 16
  ;['more', 'refresh', 'albums', 'external'].forEach((ic, k) => roundBtn(ctx, 30 + k * 32, fy + 14, ic, PX.dim))
  const dl = s('cx.download')
  const bw = measure(ctx, dl, { size: 13, weight: 600 }) + 28
  button(ctx, w - 16 - bw, fy, bw, dl, 'disabled')
}

function drawSelection(ctx, S, pop, w) {
  const s = S.s
  const y0 = VIEW_Y
  const back = s('cx.back')
  const bw = measure(ctx, back, { size: 13 }) + 24
  button(ctx, 16, y0, bw, back, 'default')
  const adv = `${s('cx.key')} / ${s('cx.manifest')}`
  button(ctx, 16 + bw + 4, y0, w - 32 - bw - 4, ellipsize(ctx, adv, w - 32 - bw - 20, { size: 12 }), 'quaternary')
  text(ctx, ROWS[0].name, 16, y0 + 58, { size: 15, weight: 600, color: PX.text })
  text(ctx, `HLS · ${s('cx.sizeUnknown')}`, 16, y0 + 80, { size: 12, color: PX.faint })

  const ready = clamp(pop.ready ?? 0)
  const submitted = clamp(pop.submitted ?? 0)
  const confirming = clamp(pop.confirming ?? 0)
  const busy = Math.max(1 - ready, confirming)
  if (busy > 0) {
    // NSpin + "Inspecting media…" while probing, "Confirming download…" after Download
    ctx.save()
    ctx.globalAlpha *= busy
    const cx = 28
    const cy = y0 + 118
    ctx.strokeStyle = rgba(PX.primary, 0.25)
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = PX.primary
    ctx.beginPath()
    ctx.arc(cx, cy, 10, S.t * 7, S.t * 7 + 1.8)
    ctx.stroke()
    text(ctx, s(confirming > 0 ? 'cx.confirming' : 'cx.loading'), 50, cy + 5, { size: 13, color: PX.text })
    ctx.restore()
  }
  if (submitted > 0) {
    ctx.save()
    ctx.globalAlpha *= submitted
    ctx.translate(0, (1 - M3.enter(submitted)) * 8)
    fillRR(ctx, 16, y0 + 92, w - 32, 34, 6, PX.successBg)
    text(ctx, s('cx.submitted'), 30, y0 + 114, { size: 13, weight: 500, color: PX.success })
    ctx.restore()
  }
  const form = ready * (1 - clamp(pop.formOut ?? 0))
  if (form <= 0) return
  ctx.save()
  ctx.globalAlpha *= form
  ctx.translate(0, (1 - M3.enter(ready)) * 10)
  text(ctx, '3:12', 16, y0 + 102, { size: 12, color: PX.faint })
  const labels = [s('cx.video'), s('cx.audio'), s('cx.subs'), s('cx.format'), s('cx.start'), s('cx.end')]
  const fmtIdx = clamp(pop.format ?? 0) >= 0.5 ? 1 : 0
  const values = ['2160p · 60 fps · hvc1 · 18432 kb/s', s('cx.audioVal'), s('cx.subsVal'), FORMATS[fmtIdx], '0', '0']
  labels.forEach((label, i) => {
    const ty = itemTop(i)
    text(ctx, label, 16, ty + 13, { size: 13, color: PX.dim })
    if (i < 4) select(ctx, 16, ty + 18, w - 32, values[i], { focus: i === 3 && (pop.menu ?? 0) > 0 })
    else {
      fillRR(ctx, 16, ty + 18, w - 32, 28, 6, PX.surfaceHi)
      strokeRR(ctx, 16.5, ty + 18.5, w - 33, 27, 6, PX.outline, 1)
      text(ctx, values[i], 26, ty + 36.5, { size: 13, color: PX.text })
      icon(ctx, 'minimize', w - 16 - 52, ty + 25, 14, PX.faint, 1.6)
      icon(ctx, 'plus', w - 16 - 26, ty + 25, 14, PX.faint, 1.6)
    }
  })
  const by = itemTop(6) + 12
  const dl = s('cx.download')
  const dw = measure(ctx, dl, { size: 13, weight: 600 }) + 32
  const cn = s('cx.cancel')
  const cw = measure(ctx, cn, { size: 13 }) + 28
  button(ctx, w - 16 - dw, by, dw, dl, 'primary', pop.press ?? 0)
  button(ctx, w - 16 - dw - 8 - cw, by, cw, cn, 'default')

  // Output format menu (NSelect)
  const menu = clamp(pop.menu ?? 0)
  if (menu > 0) {
    const my = itemTop(3) + 18 + 28 + 6
    ctx.save()
    ctx.globalAlpha *= menu
    ctx.translate(0, (1 - M3.enter(menu)) * -6)
    shadow(ctx, 16, my, w - 32, 72, 8, 24, 0.5, 8)
    fillRR(ctx, 16, my, w - 32, 72, 8, PX.surfaceHi)
    strokeRR(ctx, 16.5, my + 0.5, w - 33, 71, 8, PX.outline, 1)
    FORMATS.forEach((f, k) => {
      const oy = my + 4 + k * 32
      const selected = k === fmtIdx
      const hover = k === 1 ? clamp(pop.mkvHot ?? 0) : 0
      if (hover > 0) fillRR(ctx, 20, oy, w - 40, 32, 6, rgba('#FFFFFF', 0.08 * hover))
      text(ctx, f, 30, oy + 21, { size: 13, weight: selected ? 600 : 400, color: selected ? PX.primary : PX.text })
      if (selected) icon(ctx, 'check', w - 16 - 30, oy + 8, 16, PX.primary, 2)
    })
    ctx.restore()
  }
  ctx.restore()
}

function drawPopup(ctx, S, pop) {
  const open = clamp(pop.open)
  if (open <= 0) return
  const s = S.s
  const w = POPUP.w
  const view = clamp(pop.view ?? 0)
  const h = popupHeight(view, pop.submitted ?? 0)
  const sc = lerp(0.9, 1, spring(pop.openAge ?? 1, { freq: 2.4, damping: 0.62 }))
  ctx.save()
  ctx.globalAlpha *= clamp(open * 1.6)
  ctx.translate(POPUP.x + w, POPUP.y)
  ctx.scale(sc, sc)
  ctx.translate(-w, 0)
  shadow(ctx, 0, 0, w, h, 12, 50, 0.6, 20)
  fillRR(ctx, 0, 0, w, h, 12, PX.bg)
  strokeRR(ctx, 0.5, 0.5, w - 1, h - 1, 12, 'rgba(214,186,255,0.22)', 1)

  // Header
  drawLogo(ctx, { x: 30, y: 26, size: 26 })
  const cOpts = { size: 11, weight: 600 }
  const cw = measure(ctx, s('cx.connected'), cOpts) + 16
  fillRR(ctx, 52, 17, cw, 18, 9, PX.successBg)
  text(ctx, s('cx.connected'), 60, 30, { ...cOpts, color: PX.success })
  icon(ctx, 'gear', w - 16 - 18, 17, 18, PX.dim, 1.6)
  switchSmall(ctx, w - 16 - 18 - 12 - 32, 17, true)
  text(ctx, s('cx.intercepting'), w - 16 - 18 - 12 - 32 - 8, 30, { size: 12, color: PX.text, align: 'right' })

  // Tabs
  const tabO = { size: 14, weight: 500 }
  text(ctx, s('cx.downloads'), 16, 78, { ...tabO, color: PX.dim })
  const tabX = 16 + measure(ctx, s('cx.downloads'), tabO) + 28
  const snW = text(ctx, s('cx.sniffer'), tabX, 78, { ...tabO, color: PX.primary })
  if (pop.found > 0) {
    fillRR(ctx, tabX + snW + 6, 65, 20, 18, 9, rgba(PX.primary, 0.18))
    text(ctx, String(pop.found), tabX + snW + 16, 78, { size: 11, weight: 700, color: PX.primary, align: 'center' })
  }
  ctx.fillStyle = PX.outline
  ctx.fillRect(0, 92, w, 1)
  fillRR(ctx, tabX, 90, snW + (pop.found > 0 ? 28 : 0), 2, 1, PX.primary)

  // Sniffer toolbar
  select(ctx, 16, 104, 136, s('cx.current'))
  switchSmall(ctx, w - 16 - 28 - 10 - 32, 109, true)
  roundBtn(ctx, w - 16 - 14, 118, 'options', PX.dim)

  // Views slide like the popup's media-forward transition.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, VIEW_Y - 6, w, h - VIEW_Y + 6)
  ctx.clip()
  if (view < 1) {
    ctx.save()
    ctx.globalAlpha *= 1 - view
    ctx.translate(-view * 40, 0)
    drawCatalog(ctx, S, pop, w)
    ctx.restore()
  }
  if (view > 0) {
    ctx.save()
    ctx.globalAlpha *= view
    ctx.translate((1 - M3.enter(view)) * 40, 0)
    drawSelection(ctx, S, pop, w)
    ctx.restore()
  }
  ctx.restore()
  ctx.restore()
}

/** st: { popup: {...}, badge, badgeAge, extGlow, extPress } */
export function drawBrowser(ctx, rect, S, st) {
  const k = rect.w / BROWSER.w
  ctx.save()
  shadow(ctx, rect.x, rect.y, rect.w, rect.h, 22 * k, 80 * k, 0.6, 30 * k)
  ctx.translate(rect.x, rect.y)
  ctx.scale(k, k)
  rr(ctx, 0, 0, BROWSER.w, BROWSER.h, 22)
  ctx.fillStyle = 'rgba(12,12,30,0.94)'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#0B0B18'
  ctx.fillRect(0, 64, BROWSER.w, BROWSER.h - 64)
  drawPage(ctx, S)
  ctx.restore()
  glass(ctx, 0, 0, BROWSER.w, BROWSER.h, 22, {
    tint: '#7AA2FF',
    alpha: 0.02,
    rim: 0.45,
    rimColor: '#A9C1FF',
    sheen: 0.05,
  })
  drawChrome(ctx, S, st)
  drawPopup(ctx, S, st.popup ?? { open: 0 })
  ctx.restore()
}
