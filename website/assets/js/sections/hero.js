/**
 * Hero: the logo traces itself, the name and slogan rise, and the backdrop
 * canvas carries slow star dust and a single burst of light from the logo
 * when it fills in. The overview below (the full Rayburst window and a tour of
 * its parts) is started from here too.
 */
import { t } from '../i18n.js'
import { clamp, ease, hash, prog } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { AppWindow } from '../ui/appwindow.js'
import { setClass } from '../ui/dom.js'
import { KINDS, scenario } from '../ui/tasks.js'
import { toastsFor } from './shared.js'

const STARS = 110

export function initHero() {
  const hero = document.getElementById('hero')
  const canvas = document.getElementById('hero-fx')
  const logo = hero.querySelector('.hero-logo')
  const ctx = canvas.getContext('2d')
  let w = 0
  let h = 0
  let dpr = 1
  let origin = [0, 0]
  let size = 100

  const measure = () => {
    dpr = Math.min(1.75, window.devicePixelRatio || 1)
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    // Resizing the bitmap clears it, so only do it when the size really changes.
    if (cw !== w || ch !== h || canvas.width !== Math.round(cw * dpr)) {
      w = cw
      h = ch
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const a = logo.getBoundingClientRect()
    const b = canvas.getBoundingClientRect()
    // The rays converge near the lower-left of the mark; the glow sits at its centre.
    origin = [a.left - b.left + a.width * 0.5, a.top - b.top + a.height * 0.52]
    size = a.width
  }
  const ro = new ResizeObserver(measure)
  ro.observe(canvas)
  // The migration note can expand above the logo and move it.
  ro.observe(hero.querySelector('.hero-copy'))
  measure()

  const light = () => document.documentElement.dataset.theme === 'light'

  const drawSky = (time) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const lite = light()
    // Star dust drifting up and to the right; each mote twinkles on its own clock.
    for (let i = 0; i < STARS; i++) {
      const depth = 0.3 + hash(i, 1) * 0.7
      const x = (hash(i, 2) * (w + 80) + time * 6 * depth) % (w + 80) - 40
      const y = (hash(i, 3) * (h + 80) - time * 10 * depth + (h + 80) * 4) % (h + 80) - 40
      const tw = 0.5 + 0.5 * Math.sin(time * (0.8 + hash(i, 4) * 1.6) + i)
      const a = (0.1 + 0.45 * tw) * depth * (lite ? 0.55 : 1)
      ctx.fillStyle = lite ? `rgba(123,62,209,${a})` : `rgba(230,218,255,${a})`
      ctx.beginPath()
      ctx.arc(x, y, 0.6 + depth * 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
    // One burst when the mark fills in (≈0.75 s), then a slow breathing glow.
    const burst = prog(time, 0.7, 1.6)
    const [ox, oy] = origin
    if (burst > 0) {
      const k = ease.enter(burst)
      const fade = 1 - burst
      ctx.globalCompositeOperation = lite ? 'source-over' : 'lighter'
      ctx.strokeStyle = `rgba(214,186,255,${0.55 * fade})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(ox, oy, size * (0.4 + 3.2 * k), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    }
    const breathe = 0.75 + 0.25 * Math.sin(time * 0.9)
    const g0 = clamp(prog(time, 0.7, 0.5)) * (1 - 0.6 * prog(time, 1.2, 1.4))
    const r = size * (2.2 + 0.4 * breathe)
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r)
    const glow = lite ? '158,116,213' : '150,95,230'
    const a0 = (0.22 + 0.35 * g0) * (lite ? 0.6 : 1)
    grad.addColorStop(0, `rgba(${glow},${a0})`)
    grad.addColorStop(1, `rgba(${glow},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(ox - r, oy - r, r * 2, r * 2)
  }

  const sky = new Stage(hero, { render: drawSky, still: 3, autostart: false })

  // The overview: the full window (sidebar, list, toolbar, speedometer) with a
  // short tour of its parts; each point lights its part up, in turn or on hover.
  const host = document.getElementById('hero-app')
  const win = new AppWindow(host, { tr: t, height: 640, rows: 4, wideFrom: 0 })
  const model = scenario(
    [
      KINDS.live(-40, 2472),
      KINDS.ed2k(-60, 0.18),
      KINDS.sftp(-30, 0.34),
      KINDS.bt(-3, 0.58, 14, 1),
      KINDS.http(0, 0.52),
      KINDS.media(0, 0.36, (tr) => `${tr('connect.pageTitle')}.mkv`),
    ],
    { newestFirst: true },
  )
  const points = [...document.querySelectorAll('.ov-point')]
  const parts = {
    side: host.querySelector('.rbw-side'),
    tools: host.querySelector('.rbw-toolbar'),
    speed: host.querySelector('.rbw-speed'),
  }
  const TOUR = 3.2
  let pinned = -1
  points.forEach((point, i) => {
    const pin = () => (pinned = i)
    const unpin = () => (pinned = -1)
    point.addEventListener('pointerenter', pin)
    point.addEventListener('pointerleave', unpin)
    point.addEventListener('focus', pin)
    point.addEventListener('blur', unpin)
  })
  const app = new Stage(host, {
    still: 30,
    autostart: false,
    render: (time) => {
      const m = model(time, t)
      const on = pinned >= 0 ? pinned : Math.floor(time / TOUR) % points.length
      const spot = points[on]?.dataset.spot
      points.forEach((point, i) => setClass(point, 'is-on', i === on))
      for (const [key, el] of Object.entries(parts)) setClass(el, 'is-spot', key === spot)
      // The task cards: the newest card glows.
      if (spot === 'card' && m.tasks[0]) m.tasks[0].focus = true
      win.update(m)
      win.toasts(toastsFor(m, time, t))
    },
  })
  return {
    start() {
      hero.classList.add('is-live')
      sky.play()
      app.play()
    },
    translate() {
      win.translate()
    },
  }
}
