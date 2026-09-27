/**
 * Details, live. Three tabs advance on their own clock (a click jumps to a tab
 * and the cycle continues from there):
 *   01  Parallel connections: the connection count climbs to 48 and the file's
 *       ranges fill side by side above the real card
 *   02  Every piece: Task Details › Activity, with TaskGraphic's piece map
 *       (8 px atoms, 2 px gutters, success ramp) and the description table
 *   03  Live recording: a running timecode while HLS segments stream into the
 *       recording card
 */
import { t } from '../i18n.js'
import { clamp, hash, reducedMotion } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { CardView } from '../ui/appwindow.js'
import { h, ic, setAttr, setClass, setStyle, setText } from '../ui/dom.js'
import { bytes, clock } from '../ui/format.js'
import { BT, KINDS } from '../ui/tasks.js'

const DUR = 8
const STILL = 6
const COLORS = ['#b98cf0', '#6fdc93', '#8fb0ff']
const RANGES = 48

/** Deterministic permutation rank for the piece order. */
const RANK = (() => {
  const idx = [...Array(BT.atoms).keys()]
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(hash(i, 42) * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const rank = new Array(BT.atoms)
  idx.forEach((atom, k) => (rank[atom] = k))
  return rank
})()

function fitCanvas(canvas, height) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = canvas.clientWidth
  if (!w) return null
  if (height != null) setStyle(canvas, 'height', `${height}px`)
  const hgt = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hgt * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(hgt * dpr)
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, hgt)
  return { ctx, w, h: hgt }
}

/** Theme colours for canvas drawing, re-read only when the page theme changes. */
const themed = new Map()
function themeColors(key, read) {
  const theme = document.documentElement.dataset.theme
  const hit = themed.get(key)
  if (hit?.theme === theme) return hit.value
  const value = read()
  themed.set(key, { theme, value })
  return value
}
const css = (el, name) => getComputedStyle(el).getPropertyValue(name).trim()

function mixColor(a, b, k) {
  return `color-mix(in srgb, ${b} ${Math.round(k * 100)}%, ${a})`
}

// ── 01 · connections ─────────────────────────────────────────────────────
function panelConnections(el) {
  el.innerHTML = `
    <div class="metrics">
      <div class="metric"><b class="mono" data-m="conns">0</b><span data-k="ui.conns"></span></div>
      <div class="metric"><b class="mono" data-m="down">0 KB/s</b><span data-k="ui.d.down"></span></div>
    </div>
    <div class="lanes"><canvas></canvas></div>
    <div class="dcard"></div>`
  const canvas = el.querySelector('canvas')
  const conns = el.querySelector('[data-m="conns"]')
  const down = el.querySelector('[data-m="down"]')
  const card = new CardView(el.querySelector('.dcard'))
  const task = KINDS.http(0, 0.06)
  return (lt) => {
    const view = task(lt, t)
    card.update(view)
    setText(conns, view.right?.conns ?? 48)
    setText(down, view.right?.down ?? '')
    const g = fitCanvas(canvas)
    if (!g) return
    const { ctx, w, h: H } = g
    const cols = w > 520 ? 12 : 8
    const rows = RANGES / cols
    const gap = 6
    const cw = (w - gap * (cols - 1)) / cols
    const ch = Math.min(22, (H - gap * (rows - 1)) / rows)
    const accent = COLORS[0]
    const rail = themeColors('rail', () => css(el, '--line') || 'rgba(255,255,255,.08)')
    const open = view.right?.conns ?? RANGES
    for (let k = 0; k < RANGES; k++) {
      const x = (k % cols) * (cw + gap)
      const y = Math.floor(k / cols) * (ch + gap)
      // Connections open one by one; each range then fills at its own pace.
      const start = (k / RANGES) * 1.6
      const rate = 0.1 + 0.07 * hash(k, 9)
      const f = k < open ? clamp((lt - start) * rate + 0.06) : 0
      ctx.fillStyle = rail
      ctx.beginPath()
      ctx.roundRect(x, y, cw, ch, 4)
      ctx.fill()
      if (f <= 0) continue
      const fw = Math.max(4, cw * f)
      const grad = ctx.createLinearGradient(x, 0, x + fw, 0)
      grad.addColorStop(0, `${accent}55`)
      grad.addColorStop(1, f < 1 ? '#ffffff' : accent)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x, y, fw, ch, 4)
      ctx.fill()
    }
  }
}

// ── 02 · piece map ───────────────────────────────────────────────────────
const TABS = [
  ['information-circle-outline', 'ui.tab.general'],
  ['pulse-outline', 'ui.tab.activity'],
  ['document-text-outline', 'ui.tab.files'],
  ['people-outline', 'ui.tab.peers'],
  ['server-outline', 'ui.tab.trackers'],
]
const ROWS = ['ui.d.progress', 'ui.d.size', 'ui.d.down', 'ui.d.up', 'ui.d.uploaded', 'ui.d.ratio', 'ui.d.seeders', 'ui.conns']

function panelPieces(el) {
  el.innerHTML = `
    <div class="metrics">
      <div class="metric"><b class="mono" data-m="p">0%</b><span data-k="ui.d.progress"></span></div>
      <div class="metric"><b class="mono" data-m="s">0</b><span data-k="ui.d.seeders"></span></div>
    </div>
    <div class="rbw tdetail">
      <div class="tdetail-head"><span data-k="ui.detail"></span>${ic('close-outline')}</div>
      <div class="tdetail-tabs">${TABS.map(([n, k], i) => `<span class="${i === 1 ? 'is-on' : ''}">${ic(n)}<span data-k="${k}"></span></span>`).join('')}</div>
      <div class="tdetail-graphic"><canvas></canvas></div>
      <dl class="tdetail-rows">${ROWS.map((k) => `<div><dt data-k="${k}"></dt><dd></dd></div>`).join('')}</dl>
    </div>`
  const canvas = el.querySelector('canvas')
  const box = el.querySelector('.tdetail')
  const pEl = el.querySelector('[data-m="p"]')
  const sEl = el.querySelector('[data-m="s"]')
  const values = [...el.querySelectorAll('.tdetail-rows dd')]
  const task = KINDS.bt(-0.001, 0.02, 9.5, 0)
  const lastLevel = new Int8Array(BT.atoms)
  const changed = new Float32Array(BT.atoms).fill(-9)
  let lastT = -1
  return (lt) => {
    const v = task(lt, t)
    const d = v.detail
    const p = d.progress
    if (lt < lastT) {
      lastLevel.fill(0)
      changed.fill(-9)
    }
    lastT = lt
    setText(pEl, `${Math.floor(p * 100)}%`)
    setText(sEl, d.seeders)
    const vals = [
      `${Math.floor(p * 100)}%`,
      `${bytes(BT.size * p, 2)} / ${bytes(BT.size, 2)}`,
      `${bytes(d.v)}/s`,
      `${bytes(d.up)}/s`,
      bytes(d.uploaded, 2),
      (d.uploaded / Math.max(1, BT.size * p)).toFixed(2),
      String(d.seeders),
      String(d.conns),
    ]
    values.forEach((dd, i) => setText(dd, vals[i]))

    const w = canvas.clientWidth
    if (!w) return
    const cols = Math.floor((w + 2) / 10)
    const rows = Math.ceil(BT.atoms / cols)
    const g = fitCanvas(canvas, rows * 10 - 2)
    if (!g) return
    const { ctx } = g
    // TaskGraphic's ramp: surface container → success in quarter steps (resolved to plain colours).
    const solid = themeColors('pieces', () => {
      const empty = css(box, '--w-highest')
      const success = css(box, '--w-success')
      const probe = box.appendChild(h('<i hidden></i>'))
      const out = [0, 0.25, 0.5, 0.75].map((k) => {
        probe.style.color = mixColor(empty, success, k)
        return getComputedStyle(probe).color
      })
      probe.remove()
      return out
    })
    for (let i = 0; i < BT.atoms; i++) {
      const a = (RANK[i] / BT.atoms) * 0.96
      const count = p >= 1 ? 4 : p < a ? 0 : Math.min(4, Math.floor((p - a) / 0.01) + 1)
      const level = [0, 1, 2, 3, 3][count]
      if (level !== lastLevel[i]) {
        lastLevel[i] = level
        changed[i] = lt
      }
      const x = (i % cols) * 10
      const y = Math.floor(i / cols) * 10
      ctx.fillStyle = solid[level]
      ctx.fillRect(x, y, 8, 8)
      const fresh = Math.exp(-(lt - changed[i]) * 6)
      if (level > 0 && fresh > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * fresh})`
        ctx.fillRect(x, y, 8, 8)
      }
    }
  }
}

// ── 03 · live recording ──────────────────────────────────────────────────
const SEG_EVERY = 0.55
const SEG_SPEED = 170
const SEG_LIFE = 5

function panelLive(el) {
  el.innerHTML = `
    <div class="metrics">
      <div class="metric"><b class="mono" data-m="clock">00:00:00</b><span><i class="live-dot"></i><span data-m="label"></span></span></div>
      <div class="metric"><b class="mono" data-m="down">0 KB/s</b><span data-k="ui.d.down"></span></div>
    </div>
    <div class="segs"></div>
    <div class="dcard"></div>`
  const clockEl = el.querySelector('[data-m="clock"]')
  const label = el.querySelector('[data-m="label"]')
  const down = el.querySelector('[data-m="down"]')
  const lane = el.querySelector('.segs')
  const card = new CardView(el.querySelector('.dcard'))
  const task = KINDS.live(-1.2, 2472)
  const pool = Array.from({ length: Math.ceil(SEG_LIFE / SEG_EVERY) + 2 }, () => {
    const chip = h(`<span class="seg">${ic('film-outline')}<em></em></span>`)
    chip.style.opacity = '0'
    lane.append(chip)
    return { chip, text: chip.querySelector('em') }
  })
  return (lt) => {
    const v = task(lt, t)
    card.update(v)
    setText(clockEl, clock(v.rec))
    setText(label, `${t('ui.recording')} · ${t('ui.live')}`)
    setText(down, v.right.down)
    const width = lane.clientWidth || 600
    const newest = Math.floor(lt / SEG_EVERY)
    pool.forEach((slot, j) => {
      const k = newest - j
      const age = lt - k * SEG_EVERY
      if (k < 0 || age > SEG_LIFE) return setStyle(slot.chip, 'opacity', '0')
      const x = -150 + age * SEG_SPEED
      const y = (k % 3) * 40 + 4
      setText(slot.text, `seg-${1400 + k}.m4s`)
      setStyle(slot.chip, 'transform', `translate(${x.toFixed(1)}px, ${y}px)`)
      setStyle(slot.chip, 'opacity', x > width - 60 ? '0' : '1')
    })
  }
}

export function initDetails() {
  const view = document.getElementById('dview')
  const tabs = [...document.querySelectorAll('#dtabs .dtab')]
  const panels = [panelConnections, panelPieces, panelLive].map((make, i) => {
    const el = h(`<div class="dpanel" id="dp-${i}" role="tabpanel" style="--c: ${COLORS[i]}"></div>`)
    view.append(el)
    return { el, draw: make(el) }
  })
  const translate = () => view.querySelectorAll('[data-k]').forEach((el) => setText(el, t(el.dataset.k)))
  translate()

  let offset = 0
  let shown = -1
  const render = (time) => {
    const cycle = (((time - offset) % (DUR * 3)) + DUR * 3) % (DUR * 3)
    const idx = Math.floor(cycle / DUR)
    const local = reducedMotion() ? STILL : cycle - idx * DUR
    if (idx !== shown) {
      shown = idx
      tabs.forEach((tab, i) => setAttr(tab, 'aria-selected', String(i === idx)))
      panels.forEach((p, i) => setClass(p.el, 'is-on', i === idx))
      setStyle(view, '--c', COLORS[idx])
    }
    setStyle(tabs[idx].querySelector('.dtab-bar b'), '--p', (local / DUR).toFixed(4))
    panels[idx].draw(local)
  }
  const player = new Stage(view, { render, still: 0 })
  tabs.forEach((tab, i) =>
    tab.addEventListener('click', () => {
      offset = player.t - i * DUR
      player.seek(player.t)
    }),
  )
  return { translate }
}
