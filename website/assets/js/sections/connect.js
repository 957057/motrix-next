/**
 * Rayburst Connect, the real flow (entrypoints/popup: PopupHeader, MediaPanel,
 * MediaSelection): the extension icon counts what the page plays; the popup's
 * Sniffer lists the stream, the original file and the subtitles; the stream's
 * download opens Media options, which probes the stream, then shows the form;
 * MKV is chosen, Download is pressed, the form gives way to "Confirming
 * download…" and the success alert. A beam carries the task to Rayburst, where
 * it lands at the top of the list as "Downloading media". Loops while visible.
 */
import { t } from '../i18n.js'
import { clamp, ease, prog } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { AppWindow } from '../ui/appwindow.js'
import { esc, h, ic, rectIn, setClass, setStyle, setText } from '../ui/dom.js'
import { KINDS, scenario } from '../ui/tasks.js'
import { CURSOR_SVG, cursorPath, ribbon } from './shared.js'

const LOOP = 17
const T = {
  badge: 0.5,
  openClick: 1.15,
  rows: 1.45,
  rowClick: 2.95,
  probeEnd: 4.25,
  mkvClick: 5.25,
  dlClick: 6.2,
  submitted: 7.05,
  fly: 7.25,
  arrive: 8.05,
  close: 14.8,
  fadeOut: 16.3,
}
const CLICKS = [T.openClick, T.rowClick, T.mkvClick, T.dlClick]

const ROWS = [
  { name: 'aurora-fjord-4k.m3u8', kind: 'film-outline', meta: () => 'HLS', actions: ['copy-outline', 'options-outline', 'play-circle-outline', 'download-outline'] },
  { name: 'aurora-preview.mp4', kind: 'document-outline', meta: () => `${t('cx.fileKind')} · 12.4 MB`, actions: ['copy-outline', 'play-circle-outline', 'download-outline'] },
  { name: 'aurora-fjord.en.vtt', kind: 'text-outline', meta: () => `${t('cx.subsKind')} · 18 KB`, actions: ['copy-outline', 'download-outline'] },
]

function build(host) {
  host.innerHTML = `
    <div class="bw">
      <div class="bw-bar">
        <span class="bw-dots"><i></i><i></i><i></i></span>
        <span class="bw-url">${ic('lock-closed-outline')}aurora.example/fjord-4k</span>
        <span class="bw-ext"><img src="assets/img/connect.svg" alt="" width="20" height="20" /><b>3</b></span>
      </div>
      <div class="bw-page">
        <div class="bw-video"><canvas></canvas>
          <div class="bw-video-bar">${ic('pause-outline')}<span class="mono" data-v="time">1:12 / 3:12</span><i><b></b></i>${ic('expand-outline')}</div>
        </div>
        <div class="bw-title" data-k="connect.pageTitle"></div>
        <div class="bw-channel" data-k="connect.channel"></div>
        <div class="bw-lines"><i></i><i></i><i></i></div>
        <div class="pp">
          <div class="pp-head">
            <img src="assets/img/connect.svg" alt="" width="24" height="24" />
            <span class="pp-ok" data-k="cx.connected"></span>
            <span class="pp-switch"><span data-k="cx.intercepting"></span><i></i></span>
            ${ic('settings-outline')}
          </div>
          <div class="pp-tabs"><span data-k="cx.downloads"></span><span class="is-on"><span data-k="cx.sniffer"></span><b>3</b></span></div>
          <div class="pp-body">
            <div class="pp-view pp-cat">
              <div class="pp-row0">
                <span class="pp-select"><span data-k="cx.current"></span>${ic('chevron-down-outline')}</span>
                <span class="pp-filter" data-k="cx.filter"></span>
              </div>
              <div class="pp-row0">
                <span class="pp-select pp-grow"><span data-k="cx.all"></span>${ic('chevron-down-outline')}</span>
                <span class="pp-select pp-grow"><span data-k="cx.time"></span>${ic('chevron-down-outline')}</span>
              </div>
              ${ROWS.map(
                (r, i) => `
                <div class="pp-res" data-row="${i}">
                  <span class="pp-res-kind">${ic(r.kind)}</span>
                  <span class="pp-res-main"><span class="pp-res-name">${esc(r.name)}</span><span class="pp-res-meta"></span></span>
                  <span class="pp-res-act">${r.actions.map((a) => `<i data-a="${a}">${ic(a)}</i>`).join('')}</span>
                </div>`,
              ).join('')}
            </div>
            <div class="pp-view pp-sel is-off">
              <div class="pp-back">${ic('chevron-back-outline')}<span data-k="cx.back"></span></div>
              <div class="pp-item-name">aurora-fjord-4k.m3u8</div>
              <div class="pp-item-meta">HLS · <span data-k="cx.sizeUnknown"></span></div>
              <div class="pp-probe"><i class="spin"></i><span data-v="probe"></span></div>
              <div class="pp-form"><div>
                <div class="pp-field"><span data-k="cx.video"></span><span class="pp-select">2160p · 60 fps · hvc1${ic('chevron-down-outline')}</span></div>
                <div class="pp-field"><span data-k="cx.audio"></span><span class="pp-select">en · AAC · 2.0${ic('chevron-down-outline')}</span></div>
                <div class="pp-field"><span data-k="cx.subs"></span><span class="pp-select"><span data-k="film.language"></span> (en)${ic('chevron-down-outline')}</span></div>
                <div class="pp-field"><span data-k="cx.format"></span><span class="pp-seg"><span data-f="mp4">MP4</span><span data-f="mkv">MKV</span></span></div>
                <div class="pp-field"><span data-k="cx.start"></span><span class="pp-select">0</span></div>
                <div class="pp-field"><span data-k="cx.end"></span><span class="pp-select">0</span></div>
                <div class="pp-actions"><span class="pp-btn" data-k="cx.cancel"></span><span class="pp-btn is-primary" data-b="dl" data-k="cx.download"></span></div>
              </div></div>
              <div class="pp-done">${ic('checkmark-circle-outline')}<span data-k="cx.submitted"></span></div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  const q = (s) => host.querySelector(s)
  return {
    ext: q('.bw-ext'),
    badge: q('.bw-ext b'),
    video: q('.bw-video canvas'),
    time: q('[data-v="time"]'),
    bar: q('.bw-video-bar b'),
    popup: q('.pp'),
    cat: q('.pp-cat'),
    sel: q('.pp-sel'),
    rows: [...host.querySelectorAll('.pp-res')],
    metas: [...host.querySelectorAll('.pp-res-meta')],
    rowDl: q('.pp-res[data-row="0"] [data-a="download-outline"]'),
    probe: q('.pp-probe'),
    probeText: q('[data-v="probe"]'),
    form: q('.pp-form'),
    mp4: q('[data-f="mp4"]'),
    mkv: q('[data-f="mkv"]'),
    dl: q('[data-b="dl"]'),
    done: q('.pp-done'),
  }
}

/** The page's video: aurora curtains over a fjord, drawn on its own clock. */
function drawAurora(canvas, time) {
  const w = canvas.clientWidth
  const hh = canvas.clientHeight
  if (!w) return
  const dpr = Math.min(1.5, window.devicePixelRatio || 1)
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(hh * dpr)
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const sky = ctx.createLinearGradient(0, 0, 0, hh)
  sky.addColorStop(0, '#050a1c')
  sky.addColorStop(0.7, '#0b1a33')
  sky.addColorStop(1, '#0d1f2c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, hh)
  ctx.globalCompositeOperation = 'lighter'
  for (let band = 0; band < 3; band++) {
    const hue = band === 1 ? '120,110,255' : '80,240,170'
    for (let x = 0; x <= w; x += 6) {
      const u = x / w
      const y = hh * (0.2 + 0.1 * band) + Math.sin(u * 5 + time * 0.5 + band * 1.7) * hh * 0.08 + Math.sin(u * 13 - time * 0.9) * hh * 0.02
      const len = hh * (0.28 + 0.12 * Math.sin(u * 7 + time * 0.7 + band))
      const a = 0.06 + 0.05 * Math.sin(u * 9 + time * 1.3 + band * 2)
      const g = ctx.createLinearGradient(0, y, 0, y + len)
      g.addColorStop(0, `rgba(${hue},0)`)
      g.addColorStop(0.35, `rgba(${hue},${a})`)
      g.addColorStop(1, `rgba(${hue},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x, y, 6, len)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#04070e'
  ctx.beginPath()
  ctx.moveTo(0, hh)
  const ridge = [0.78, 0.62, 0.7, 0.55, 0.66, 0.74, 0.6, 0.72, 0.8]
  ridge.forEach((r, i) => ctx.lineTo((i / (ridge.length - 1)) * w, hh * r))
  ctx.lineTo(w, hh)
  ctx.fill()
  ctx.fillStyle = 'rgba(80,240,170,0.05)'
  ctx.fillRect(0, hh * 0.86, w, hh * 0.14)
}

export function initConnect() {
  const stage = document.getElementById('connect-stage')
  const host = document.getElementById('connect-browser')
  const fx = document.getElementById('connect-fx')
  const ui = build(host)
  const cursor = h(CURSOR_SVG)
  stage.append(cursor)
  const beam = ribbon(fx, '#a8b8ff')
  const appHost = document.getElementById('connect-app')
  // The window is never taller than the browser beside it, so the two read as a pair.
  const win = new AppWindow(appHost, { tr: t, height: 700, rows: 4, match: host.querySelector('.bw') })
  const model = scenario(
    [
      KINDS.sftp(-20, 0.4),
      KINDS.bt(-50, 0.2, 14, 0),
      KINDS.http(-30, 0),
      KINDS.media(T.arrive, 0, (tr) => `${tr('connect.pageTitle')}.mkv`),
    ],
    { newestFirst: true },
  )

  const translate = () => {
    host.querySelectorAll('[data-k]').forEach((el) => setText(el, t(el.dataset.k)))
    ui.metas.forEach((el, i) => setText(el, ROWS[i].meta()))
    win.translate()
  }
  translate()

  const center = (el) => () => {
    const r = rectIn(el, stage)
    return [r.x + r.w / 2, r.y + r.h / 2]
  }
  const rest = () => {
    const r = rectIn(host, stage)
    return [r.x + r.w * 0.45, r.y + r.h * 0.55]
  }
  const keys = [
    { t: 0, at: rest },
    { t: 0.4, at: rest },
    { t: T.openClick - 0.05, at: center(ui.ext) },
    { t: T.openClick + 0.35, at: center(ui.ext) },
    { t: T.rowClick - 0.05, at: center(ui.rowDl) },
    { t: T.rowClick + 0.6, at: center(ui.rowDl) },
    { t: T.mkvClick - 0.05, at: center(ui.mkv) },
    { t: T.mkvClick + 0.3, at: center(ui.mkv) },
    { t: T.dlClick - 0.05, at: center(ui.dl) },
    { t: T.dlClick + 0.5, at: center(ui.dl) },
  ]

  let last = 0
  const render = (time) => {
    // Clicks: a ripple where the pointer is.
    for (const c of CLICKS) {
      if (last < c && time >= c) {
        const [x, y] = cursorPath(keys, c, ease.inOut)
        const ripple = h('<i class="ripple"></i>')
        ripple.style.translate = `${x}px ${y}px`
        stage.append(ripple)
        ripple.addEventListener('animationend', () => ripple.remove())
      }
    }
    last = time

    drawAurora(ui.video, time)
    const played = 72 + time
    setText(ui.time, `${Math.floor(played / 60)}:${String(Math.floor(played % 60)).padStart(2, '0')} / 3:12`)
    setStyle(ui.bar, '--p', (played / 192).toFixed(4))
    setClass(ui.badge, 'is-on', time >= T.badge)

    const open = time >= T.openClick && time < T.close
    setClass(ui.popup, 'is-open', open)
    setClass(ui.ext, 'is-on', open)
    ui.rows.forEach((row, i) => setClass(row, 'is-on', time >= T.rows + i * 0.15))
    setClass(ui.rows[0], 'is-hot', time >= T.rowClick - 0.6 && time < T.rowClick + 0.2)
    setClass(ui.rowDl, 'is-hot', time >= T.rowClick - 0.3 && time < T.rowClick + 0.2)
    const selecting = time >= T.rowClick + 0.05
    setClass(ui.cat, 'is-off', selecting)
    setClass(ui.sel, 'is-off', !selecting)
    const formOn = time >= T.probeEnd && time < T.dlClick + 0.1
    const confirming = time >= T.dlClick + 0.1 && time < T.submitted
    setClass(ui.form, 'is-on', formOn)
    setStyle(ui.probe, 'display', (time < T.probeEnd || confirming) && selecting ? '' : 'none')
    setText(ui.probeText, t(confirming ? 'cx.confirming' : 'cx.loading'))
    const mkv = time >= T.mkvClick
    setClass(ui.mp4, 'is-on', !mkv)
    setClass(ui.mkv, 'is-on', mkv)
    setClass(ui.dl, 'is-press', time >= T.dlClick - 0.05 && time < T.dlClick + 0.12)
    setStyle(ui.done, 'display', time >= T.submitted ? '' : 'none')

    const [cx, cy] = cursorPath(keys, time, ease.inOut)
    cursor.style.translate = `${cx - 4}px ${cy - 3}px`
    setClass(cursor, 'is-hidden', time < 0.3 || time > T.dlClick + 0.8)

    // Hand-off beam from the success alert to the top of Rayburst's list.
    const u = prog(time, T.fly, T.arrive - T.fly)
    const beamFade = 1 - prog(time, T.arrive, 0.6)
    if (u > 0 && beamFade > 0) {
      const a = rectIn(ui.done, stage)
      const b = rectIn(win.list, stage)
      beam.update([a.x + a.w - 12, a.y + a.h / 2], [b.x + 30 * (win.scale ?? 1), b.y + 20 * (win.scale ?? 1)], ease.inOut(u), beamFade)
    } else beam.update([0, 0], [0, 0], 0, 0)

    const m = model(time, t)
    if (m.byId.media && time < T.arrive + 1) m.byId.media.focus = true
    win.update(m)
    // Soft reset around the loop point: dim out, restart, brighten back.
    const dim = Math.max(prog(time, T.fadeOut, LOOP - T.fadeOut), 1 - prog(time, 0, 0.5))
    setStyle(appHost, 'opacity', (1 - 0.65 * clamp(dim)).toFixed(3))
  }
  new Stage(stage, { render, loop: LOOP, still: 11 })
  return { translate }
}
