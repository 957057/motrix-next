/**
 * Vector rebuild of the Rayburst main window, measured from
 * rayburst/docs/media/screenshot-{dark,light}.png and the component styles:
 *   AppSidebar · task toolbar · TaskItem (TaskDragHandle, TaskItemActions,
 *   status badge, NProgress, info row) · pager · Speedometer capsule ·
 *   completion toast (useNotificationToast).
 * Local space is a 1280×800 window in CSS pixels; drawAppWindow scales it into
 * any rect. Overlays (New Task dialog, detail drawer) are passed as layers.
 */
import { THEMES } from '../brand/palette.js'
import { drawLogo } from '../brand/logo.js'
import { circle, fillRR, rr, shadow, strokeRR } from '../core/draw.js'
import { M3 } from '../core/ease.js'
import { icon } from '../core/icons.js'
import { clamp, mix, rgba } from '../core/math.js'
import { ellipsize, fmt, measure, text } from '../core/text.js'

export const WIN = { w: 1280, h: 800 }
export const SIDEBAR = 176
export const LIST = { x: 200, y: 104, w: 1056, gap: 16, bottom: 736 }
const PILL_SLOT = 38

// ── Card geometry ───────────────────────────────────────────────────────

/**
 * TaskItem height: 1px border, 16px padding, 32px header (action pill),
 * 18px status slot (only with a badge), 10 + 6px progress bar (absent for
 * indeterminate media), 8 + 14px info row, 16px padding, 1px border.
 */
export function cardHeight(task) {
  const badge = clamp(task.badgeK ?? (task.badge ? 1 : 0))
  return 104 + 18 * badge - (task.progress == null ? 6 : 0)
}

/** Local boxes of each card; `insert` cards push the list down as they enter. */
export function cardLayout(tasks) {
  let y = LIST.y
  return tasks.map((task) => {
    const e = M3.enter(clamp(task.appear ?? 1))
    const h = cardHeight(task)
    const top = y
    y += (h + LIST.gap) * (task.insert ? e : 1)
    return { x: LIST.x, top, w: LIST.w, h }
  })
}

/** Action pill geometry (TaskItemActions: 32px tall, 12px padding, 38px slots). */
export function actionPill(task, box) {
  const n = task.actions?.length ?? 0
  const w = 24 + n * PILL_SLOT
  const x = box.x + box.w - 1 - 12 - w
  const y = box.top + 17
  return { x, y, w, h: 32, slot: (i) => [x + 12 + i * PILL_SLOT + PILL_SLOT / 2, y + 16] }
}

/** Local point of a named action icon on a card (for cursor targets). */
export function actionPoint(task, box, name) {
  const i = Math.max(0, (task.actions ?? []).indexOf(name))
  return actionPill(task, box).slot(i)
}

/** Convert a window-local point to screen space for a given rect. */
export function winPoint(rect, [lx, ly]) {
  const k = rect.w / WIN.w
  return [rect.x + lx * k, rect.y + ly * k]
}

// ── Formatting (Rayburst shared/utils/format.ts and media.ts) ────────────

/** bytesToSize(bytes, precision) */
export function bytes(n, precision = 1) {
  const b = Math.max(0, Math.floor(n))
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (b === 0) return '0 KB'
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(b) / Math.log(1024)))
  if (i === 0) return `${b} ${sizes[i]}`
  return `${(b / 1024 ** i).toFixed(precision)} ${sizes[i]}`
}

/** timeFormat(seconds, { prefix }) with the app's h / m / s units. */
export function remaining(s, seconds) {
  let secs = Math.floor(seconds)
  if (secs <= 0) return ''
  let out = ''
  if (secs > 3600) {
    out += `${Math.floor(secs / 3600)}${s('ui.h')} `
    secs %= 3600
  }
  if (secs > 60) {
    out += `${Math.floor(secs / 60)}${s('ui.m')} `
    secs %= 60
  }
  return `${s('ui.remaining')} ${out}${secs}${s('ui.s')}`
}

/** mediaDuration: always HH:MM:SS. */
export function mediaDuration(seconds) {
  const v = Math.max(0, Math.floor(seconds))
  return [Math.floor(v / 3600), Math.floor(v / 60) % 60, v % 60].map((p) => String(p).padStart(2, '0')).join(':')
}

export function duration(sec) {
  const v = Math.max(0, Math.round(sec))
  const pad = (x) => String(x).padStart(2, '0')
  return `${Math.floor(v / 60)}:${pad(v % 60)}`
}

// ── Pieces ──────────────────────────────────────────────────────────────

const TONE = {
  success: (th) => th.success,
  error: (th) => th.error,
  waiting: (th) => th.info,
  muted: (th) => th.outline,
}

function drawSidebar(ctx, th, s, counts) {
  ctx.fillStyle = th.sidebar
  ctx.fillRect(0, 0, SIDEBAR, WIN.h)
  text(ctx, s('ui.tasks'), 20, 66, { size: 17, weight: 700, color: th.text })
  const items = [
    ['list', 'ui.all', counts.all],
    ['play', 'ui.progress', counts.progress],
    ['alert', 'ui.failed', counts.failed],
    ['checks', 'ui.completed', counts.completed],
  ]
  items.forEach(([ic, key, n], i) => {
    const y = 96 + i * 42
    const on = i === 0
    if (on) fillRR(ctx, 8, y, 160, 38, 8, th.active)
    icon(ctx, ic, 20, y + 11, 16, th.textDim, 1.5)
    text(ctx, s(key), 46, y + 24, { size: 14, weight: 500, color: th.text })
    fillRR(ctx, 131, y + 10, 26, 18, 9, on ? th.badgeActive : th.badge)
    text(ctx, String(Math.round(n)), 144, y + 23, { size: 11, weight: 600, color: th.textDim, align: 'center' })
  })
  icon(ctx, 'info', 20, WIN.h - 76, 16, th.textDim, 1.5)
  text(ctx, s('ui.about'), 46, WIN.h - 63, { size: 14, color: th.text })
  icon(ctx, 'gear', 20, WIN.h - 34, 16, th.textDim, 1.5)
  text(ctx, s('ui.settings'), 46, WIN.h - 21, { size: 14, color: th.text })
}

/** Toolbar button centres (local). */
export const TOOLBAR = { add: [1018, 60] }

function drawToolbar(ctx, th, s, st) {
  text(ctx, s('ui.all'), LIST.x, 68, { size: 17, weight: 700, color: th.text })
  const press = clamp(st.addPress ?? 0)
  circle(ctx, 1018, 60, 14 * (1 - 0.08 * Math.sin(Math.PI * press)), th.primary)
  icon(ctx, 'plus', 1009, 51, 18, th.onPrimary, 2)
  const rest = [
    ['sort', true],
    ['refresh', true],
    ['play', false],
    ['pause', false],
    ['stopCircle', false],
    ['close', false],
    ['trash', false],
  ]
  rest.forEach(([ic, on], i) => icon(ctx, ic, 1050 + i * 32 - 9, 51, 18, on ? th.text : th.outline, 1.6))
  ctx.fillStyle = th.outlineVariant
  ctx.fillRect(LIST.x, 86.5, WIN.w - 24 - LIST.x, 1.5)
}

function drawWindowControls(ctx, th) {
  icon(ctx, 'minimize', WIN.w - 124, 10, 14, th.textDim, 1.3)
  icon(ctx, 'maximize', WIN.w - 79, 10, 14, th.textDim, 1.3)
  icon(ctx, 'close', WIN.w - 33, 10, 14, th.textDim, 1.3)
}

function progressBar(ctx, th, x, y, w, h, p, color, active, t) {
  fillRR(ctx, x, y, w, h, h / 2, th.rail)
  if (p <= 0) return
  const fw = Math.max(h, w * clamp(p))
  fillRR(ctx, x, y, fw, h, h / 2, color)
  if (active) {
    // NProgress "processing": a soft highlight sweeping along the filled part.
    const u = ((t * 0.55) % 1.4) - 0.2
    const cx = x + fw * u
    ctx.save()
    rr(ctx, x, y, fw, h, h / 2)
    ctx.clip()
    const g = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, fw, h)
    ctx.restore()
  }
}

function dragDots(ctx, th, x, cy) {
  const c = rgba(th.outline, 0.52)
  for (const dx of [-2.5, 2.5]) for (const dy of [-5, 0, 5]) circle(ctx, x + dx, cy + dy, 1.15, c)
}

function drawInfoRight(ctx, th, right, x1, y) {
  const o = { size: 12, color: th.textDim }
  const items = []
  if (right.remaining) items.push([null, right.remaining])
  if (right.up != null) items.push(['arrowUp', right.up])
  if (right.down != null) items.push(['arrowDown', right.down])
  if (right.seeders != null) items.push(['magnet', String(right.seeders)])
  if (right.conns != null) items.push(['network', String(right.conns)])
  let x = x1
  for (let i = items.length - 1; i >= 0; i--) {
    const [ic, str] = items[i]
    const w = measure(ctx, str, o)
    x -= w
    text(ctx, str, x, y, o)
    if (ic) {
      x -= 12
      icon(ctx, ic, x, y - 9.5, 10, th.textDim, 1.6)
    }
    x -= 8
  }
}

/**
 * task: { name, actions[], badge {label, tone, icon}, badgeK, sharing, progress
 *   (null = indeterminate), color, active, left, right {remaining, up, down,
 *   seeders, conns}, appear, insert, focus (0..1 highlight), hot (action name) }
 */
function drawCard(ctx, th, task, box, t) {
  const e = M3.enter(clamp(task.appear ?? 1))
  if (e <= 0) return
  const { x, top: y, w, h } = box
  ctx.save()
  ctx.globalAlpha *= clamp(e * 1.5)
  ctx.translate(0, (1 - e) * 16)

  fillRR(ctx, x, y, w, h, 6, th.item)
  ctx.save()
  rr(ctx, x, y, w, h, 6)
  ctx.clip()
  const share = clamp(task.sharing ?? 0)
  if (share > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w * 0.4, 0)
    g.addColorStop(0, rgba(th.success, 0.06 * share))
    g.addColorStop(1, rgba(th.success, 0))
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
  }
  // Drag rail (TaskDragHandle)
  ctx.fillStyle = mix(th.item, th.text, 0.06)
  ctx.fillRect(x + 3, y, 24, h)
  const rail = ctx.createLinearGradient(x + 3, 0, x + 27, 0)
  rail.addColorStop(0, rgba(th.text, 0.07))
  rail.addColorStop(0.76, rgba(th.text, 0))
  ctx.fillStyle = rail
  ctx.fillRect(x + 3, y, 24, h)
  ctx.fillStyle = rgba(th.outlineVariant, 0.54)
  ctx.fillRect(x + 26, y, 1, h)
  // Left border: outline-variant, success while sharing.
  ctx.fillStyle = share > 0 ? mix(th.outlineVariant, th.success, share) : th.outlineVariant
  ctx.fillRect(x, y, 3, h)
  ctx.restore()
  strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6, th.outlineVariant, 1)
  dragDots(ctx, th, x + 15, y + h / 2)

  const bx = x + 3 + 24 + 12
  const by = y + 1 + 16
  const bw = x + w - 1 - 12 - bx

  // Header: name + action pill
  const pill = actionPill(task, box)
  const nameOpts = { size: 14, color: th.textDim }
  text(ctx, ellipsize(ctx, task.name, pill.x - 20 - bx, nameOpts), bx, by + 18, nameOpts)
  fillRR(ctx, pill.x, pill.y, pill.w, pill.h, 16, th.item)
  strokeRR(
    ctx,
    pill.x + 0.5,
    pill.y + 0.5,
    pill.w - 1,
    pill.h - 1,
    15.5,
    task.hot ? th.outline : th.containerHighest,
    1,
  )
  ;(task.actions ?? []).forEach((ic, i) => {
    const [cx, cy] = pill.slot(i)
    if (task.hot === ic) circle(ctx, cx, cy, 15, rgba(th.text, 0.1))
    icon(ctx, ic, cx - 9, cy - 9, 18, task.hot === ic ? th.text : th.outline, 1.6)
  })

  // Status slot (only with a badge)
  const bk = clamp(task.badgeK ?? (task.badge ? 1 : 0))
  if (task.badge && bk > 0) {
    ctx.save()
    ctx.globalAlpha *= 0.9 * bk
    const col = (TONE[task.badge.tone] ?? TONE.muted)(th)
    const ty = by + 32 + 14 - (1 - bk) * 3
    if (task.badge.icon) icon(ctx, task.badge.icon, bx, ty - 11, 13, col, 1.8)
    text(ctx, task.badge.label, bx + (task.badge.icon ? 16 : 0), ty, { size: 13, color: col })
    ctx.restore()
  }

  let py = by + 32 + 18 * bk + 10
  if (task.progress != null) {
    progressBar(ctx, th, bx, py, bw, 6, task.progress, th[task.color] ?? task.color ?? th.primary, task.active, t)
    py += 6
  }
  const iy = py + 8 + 11
  if (task.left) text(ctx, task.left, bx, iy, { size: 12, color: th.textDim })
  if (task.right) drawInfoRight(ctx, th, task.right, bx + bw, iy)

  if (task.focus > 0) {
    ctx.save()
    ctx.globalAlpha *= clamp(task.focus)
    strokeRR(ctx, x - 3, y - 3, w + 6, h + 6, 9, th.primary, 2)
    ctx.restore()
  }
  ctx.restore()
}

function drawPager(ctx, th, s) {
  const y = WIN.h - 48
  fillRR(ctx, LIST.x, y, 192, 28, 14, th.container)
  strokeRR(ctx, LIST.x + 0.5, y + 0.5, 191, 27, 13.5, th.outlineVariant, 1)
  icon(ctx, 'chevronLeft', LIST.x + 12, y + 8, 12, th.outline, 1.6)
  strokeRR(ctx, LIST.x + 37.5, y + 4.5, 21, 19, 4, th.primary, 1)
  text(ctx, '1', LIST.x + 48, y + 18, { size: 12, color: th.primary, align: 'center' })
  icon(ctx, 'chevronRight', LIST.x + 72, y + 8, 12, th.outline, 1.6)
  strokeRR(ctx, LIST.x + 97.5, y + 3.5, 88, 21, 4, th.outlineVariant, 1)
  text(ctx, s('ui.perPage'), LIST.x + 108, y + 18, { size: 12, color: th.text })
  icon(ctx, 'chevron', LIST.x + 168, y + 9, 11, th.outline, 1.5)
}

function drawSpeedometer(ctx, th, speed) {
  const w = 205
  const h = 44
  const x = WIN.w - 24 - w
  const y = WIN.h - 12 - h
  const active = speed.active !== false
  fillRR(ctx, x, y, w, h, 22, th.container)
  strokeRR(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 21.5, th.outlineVariant, 1)
  icon(ctx, 'speed', x + 14, y + 11, 22, active ? th.primary : th.outline, 1.6)
  const rows = [
    ['arrowUp', speed.up, y + 19],
    ['arrowDown', speed.down, y + 35],
  ]
  for (const [ic, v, ry] of rows) {
    icon(ctx, ic, x + 50, ry - 9, 10, th.textDim, 1.6)
    text(ctx, `${v}/s`, x + 63, ry, { size: 12, weight: 600, color: active ? th.text : th.textDim })
    ctx.fillStyle = th.outline
    for (let k = 0; k < 3; k++) ctx.fillRect(x + w - 42, ry - 10 + k * 4, 1, 2)
    text(ctx, '∞', x + w - 24, ry, { size: 13, color: th.outline, align: 'center' })
  }
}

/** Naive message.success with the completion toast's inline buttons. */
function drawToast(ctx, th, s, toast, index) {
  const p = clamp(toast.p)
  if (p <= 0) return
  const e = M3.enter(p)
  const body = { size: 14, color: th.text }
  const btn = { size: 13, weight: 500, color: th.primary }
  const bw = measure(ctx, toast.text, body)
  const b1 = measure(ctx, s('ui.openFile'), btn) + 20
  const b2 = measure(ctx, s('ui.showInFolder'), btn) + 20
  const w = 18 + 20 + 10 + bw + 16 + b1 + 8 + b2 + 14
  const h = 46
  const x = (WIN.w - w) / 2
  const y = 14 + index * 56 - (1 - e) * 26
  ctx.save()
  ctx.globalAlpha *= clamp(p * 2.5) * (1 - clamp(toast.out ?? 0))
  shadow(ctx, x, y, w, h, 10, 24, th.shadow * 0.8, 6)
  fillRR(ctx, x, y, w, h, 10, th.containerHighest)
  circle(ctx, x + 28, y + h / 2, 10, th.success)
  icon(ctx, 'check', x + 21, y + h / 2 - 7, 14, th.onSuccess, 2.4)
  text(ctx, toast.text, x + 48, y + h / 2 + 5, body)
  let bx = x + 48 + bw + 16
  for (const [label, bwid] of [
    [s('ui.openFile'), b1],
    [s('ui.showInFolder'), b2],
  ]) {
    fillRR(ctx, bx, y + 9, bwid, 28, 6, rgba(th.primary, 0.14))
    text(ctx, label, bx + 10, y + 28, btn)
    bx += bwid + 8
  }
  ctx.restore()
}

/** Draw the window content in local 0..1280 × 0..800 space. */
export function drawWindowContent(ctx, S, state) {
  const th = typeof state.theme === 'string' ? THEMES[state.theme] : (state.theme ?? THEMES.dark)
  ctx.fillStyle = th.main
  ctx.fillRect(SIDEBAR, 0, WIN.w - SIDEBAR, WIN.h)
  drawSidebar(ctx, th, S.s, state.counts ?? { all: 0, progress: 0, failed: 0, completed: 0 })
  drawWindowControls(ctx, th)
  drawToolbar(ctx, th, S.s, state)
  const tasks = state.tasks ?? []
  if (!tasks.length) drawLogo(ctx, { x: 728, y: 412, size: 230, mono: th.emptyLogo })
  ctx.save()
  ctx.beginPath()
  ctx.rect(LIST.x - 12, 96, LIST.w + 24, LIST.bottom - 96)
  ctx.clip()
  const boxes = state.boxes ?? cardLayout(tasks)
  tasks.forEach((task, i) => drawCard(ctx, th, task, boxes[i], S.t))
  ctx.restore()
  drawPager(ctx, th, S.s)
  drawSpeedometer(ctx, th, state.speed ?? { up: '0 KB', down: '0 KB', active: false })
  for (const layerFn of state.layers ?? []) layerFn(ctx, th)
  ;(state.toasts ?? (state.toast ? [state.toast] : [])).forEach((toast, i) => drawToast(ctx, th, S.s, toast, i))
}

/**
 * Draw the window into rect {x, y, w, h, r}.
 * state: { theme, tasks, counts, speed, toasts[], layers[], content (0..1), shadow }
 */
export function drawAppWindow(ctx, rect, state, S) {
  const th = typeof state.theme === 'string' ? THEMES[state.theme] : (state.theme ?? THEMES.dark)
  const k = rect.w / WIN.w
  const radius = rect.r ?? 12 * k
  if (state.shadow !== 0)
    shadow(ctx, rect.x, rect.y, rect.w, rect.h, radius, 70 * Math.max(k, 0.4), 0.55 * (state.shadow ?? 1), 30 * k)
  ctx.save()
  rr(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.fillStyle = th.sidebar
  ctx.fill()
  ctx.clip()
  const content = clamp(state.content ?? 1)
  if (content > 0) {
    ctx.save()
    ctx.globalAlpha *= content
    ctx.translate(rect.x, rect.y)
    ctx.scale(k, k)
    drawWindowContent(ctx, S, { ...state, theme: th })
    ctx.restore()
  }
  ctx.restore()
  ctx.save()
  rr(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.strokeStyle = th.name === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

export { fmt }
