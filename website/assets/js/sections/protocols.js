/**
 * Every protocol, in one place. Six protocol families on the left light up
 * one after another: the name fills with colour, its real link types out, and
 * a ribbon of light carries it into the live window on the right, where the
 * task lands at the top of the list. The magnet link becomes a torrent task
 * ("Fetching torrent"); BitTorrent lights up when its metadata arrives and the
 * same task starts downloading pieces. After the sequence, a click on any
 * protocol sends its ribbon again.
 */
import { t } from '../i18n.js'
import { clamp, ease, prog } from '../core/motion.js'
import { Stage } from '../core/stage.js'
import { AppWindow } from '../ui/appwindow.js'
import { esc, rectIn, setClass, setText } from '../ui/dom.js'
import { KINDS, LINKS, scenario } from '../ui/tasks.js'
import { ribbon, toastsFor } from './shared.js'

const START = 0.6
const STEP = 1.7
const FLY = 0.55
const at = (i) => START + i * STEP
const land = (i) => at(i) + FLY

const LINES = [
  { name: () => 'HTTP(S)', kind: 'proto.k.files', c: '#A98BFF', link: LINKS.http, task: 'http' },
  { name: () => 'SFTP', kind: 'proto.k.files', c: '#7C95FF', link: LINKS.sftp, task: 'sftp' },
  { name: () => t('proto.magnet'), kind: 'proto.k.p2p', c: '#FF7A93', link: LINKS.magnet, task: 'bt' },
  { name: () => 'BitTorrent', kind: 'proto.k.p2p', c: '#5FD39A', link: 'btih:9c4e2b7d1a0f53e8… · 642 MB · 2568 pieces', task: 'bt' },
  { name: () => 'ED2K', kind: 'proto.k.p2p', c: '#F0B64A', link: LINKS.ed2k, task: 'ed2k' },
  { name: () => 'HLS · DASH', kind: 'proto.k.streams', c: '#4FD0E6', link: LINKS.live, task: 'live' },
]
const END = land(LINES.length - 1) + 0.6

export function initProtocols() {
  const stage = document.getElementById('proto-stage')
  const list = document.getElementById('proto-list')
  const fx = document.getElementById('proto-fx')
  list.innerHTML = LINES.map(
    (ln, i) => `
      <li><button class="proto" type="button" data-i="${i}" style="--c0: ${ln.c}">
        <span class="proto-name"></span>
        <span class="proto-kind" data-i18n="${ln.kind}">${esc(t(ln.kind))}</span>
        <code class="proto-link"></code>
      </button></li>`,
  ).join('')
  const rows = [...list.querySelectorAll('.proto')]
  const names = rows.map((r) => r.querySelector('.proto-name'))
  const links = rows.map((r) => r.querySelector('.proto-link'))
  const ribbons = LINES.map((ln) => ribbon(fx, ln.c))
  const translate = () =>
    names.forEach((el, i) => {
      const name = LINES[i].name()
      el.textContent = name
      el.dataset.name = name
    })
  translate()

  const win = new AppWindow(document.getElementById('proto-app'), { tr: t, height: 700, rows: 5 })
  const model = scenario(
    [
      KINDS.http(land(0), 0),
      KINDS.sftp(land(1), 0),
      KINDS.bt(land(2), 0, 16, land(3) - land(2)),
      KINDS.ed2k(land(4), 0),
      KINDS.live(land(5), 0),
    ],
    { newestFirst: true },
  )

  // After the sequence, a click re-sends that protocol.
  let replayIdx = -1
  let replayAt = -10
  rows.forEach((row, i) =>
    row.addEventListener('click', () => {
      if (player.t < END) return
      replayIdx = i
      replayAt = player.t
    }),
  )

  const target = (i) => {
    // A new task lands at the top of the list; BitTorrent (and replays) go to the existing card.
    const r = rectIn(win.cardEl(LINES[i].task) ?? win.list, stage)
    return [r.x + 40 * (win.scale ?? 1), r.y + 24 * (win.scale ?? 1)]
  }
  const source = (i) => {
    const r = rectIn(names[i], stage)
    const rtl = document.documentElement.dir === 'rtl'
    return [rtl ? r.x : r.x + r.w, r.y + r.h * 0.55]
  }

  const render = (time) => {
    const m = model(time, t)
    // Brief focus ring where a ribbon lands.
    LINES.forEach((ln, i) => {
      const landed = replayIdx === i ? replayAt + FLY : land(i)
      const task = m.byId[ln.task]
      if (task && time >= landed && time < landed + 0.9) task.focus = true
    })
    win.update(m)
    win.toasts(toastsFor(m, time, t))

    let current = -1
    LINES.forEach((ln, i) => {
      const lit = time >= at(i)
      if (lit) current = i
      setClass(rows[i], 'is-lit', lit)
      const typed = clamp((time - at(i)) / 0.5)
      const chars = [...ln.link]
      setText(links[i], chars.slice(0, Math.ceil(chars.length * typed)).join(''))
    })
    if (time >= END && replayIdx >= 0) current = replayIdx
    rows.forEach((row, i) => setClass(row, 'is-current', i === current))

    LINES.forEach((ln, i) => {
      const start = replayIdx === i && time >= replayAt ? replayAt : at(i)
      const u = prog(time, start + 0.05, FLY)
      const fade = 1 - prog(time, start + 0.05 + FLY, 0.5)
      if (u <= 0 || fade <= 0) return ribbons[i].update([0, 0], [0, 0], 0, 0)
      ribbons[i].update(source(i), target(i), ease.inOut(u), 0.9 * fade)
    })
  }

  const player = new Stage(stage, { render, still: END + 1 })
  document.getElementById('proto-replay').addEventListener('click', () => {
    replayIdx = -1
    player.replay()
  })
  return { translate: () => (translate(), win.translate()) }
}
