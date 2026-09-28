/**
 * Task list model, a pure function of time.
 *
 * The five links pasted into the New Task dialog become these five tasks, and
 * the Connect hand-off inserts a sixth at the top. The same model drives the
 * protocols, app and Connect scenes and the detail drawer, so every number
 * stays continuous across cuts. Badges, colours, action sets and info rows
 * follow Rayburst's useTaskCardModel, TaskItem and TaskItemActions:
 *   - plain active downloads carry no badge;
 *   - metadata fetching and media states use the info (waiting) tone;
 *   - completed and seeding use success; seeding also turns the left border;
 *   - live media is indeterminate (no progress bar, "HH:MM:SS / Live");
 *   - the right side of the info row shows only while a task is active.
 */
import { bytes, mediaDuration, remaining } from '../ui/appwindow.js'
import { clamp, fbm1, lerp, permutation } from '../core/math.js'
import { M3, prog } from '../core/ease.js'
import { fmt } from '../core/text.js'

const MB = 1024 * 1024

/** The links, one per line, exactly as they are pasted. */
export const LINKS = [
  'https://download.blender.org/release/Blender4.5/blender-4.5.3-linux-x64.tar.xz',
  'sftp://nas.local/backup/photos-2026.tar',
  'magnet:?xt=urn:btih:9c4e2b7d1a0f53e8b6d2c1a7f0e39d84b5c6a217&dn=bbb-4k60',
  'ed2k://|file|debian-13.iso|4011851776|4A7C1F2E9B03D6C58E21F0A7B3D94C61|/',
  'https://live.example.com/keynote-live.m3u8',
]

export const BT = { atoms: 642, size: 642 * MB, name: 'bbb_sunflower_2160p_60fps_normal.mp4' }
const BT_ORDER = (() => {
  const perm = permutation(BT.atoms, 42)
  const rank = new Array(BT.atoms)
  perm.forEach((atom, k) => {
    rank[atom] = k
  })
  return rank
})()

const ACT = {
  active: ['pause', 'folderOpen', 'link', 'info', 'close'],
  complete: ['external', 'folderOpen', 'refresh', 'link', 'info', 'trash'],
  seeding: ['pause', 'stopCircle', 'folderOpen', 'link', 'info', 'close'],
  recording: ['stopCircle', 'pause', 'folderOpen', 'link', 'info', 'close'],
}

/** Accelerate for the first fifth, then flow almost linearly. */
function curve(u) {
  const x = clamp(u)
  return clamp(x < 0.2 ? (x * x) / 0.4 : 0.1 + (x - 0.2) * 1.125)
}

function smoothRamp(u) {
  const x = clamp(u)
  return x * x * (3 - 2 * x)
}

/** Status-slot height animation (0.42 s, emphasized decelerate). */
function slot(t, on, off = Infinity) {
  return M3.emphasized(prog(t, on, 0.42)) * (1 - M3.emphasized(prog(t, off, 0.42)))
}

function pct(p) {
  return Math.floor(clamp(p) * 100)
}

export function taskModel(T, s, t) {
  const spawn = (i) => T.ev(`card${i}`) + 0.05
  const done0 = T.ev('done0')
  const done1 = T.ev('done1')
  const arrive = T.ev('arrive')
  const jitter = (seed) => 1 + 0.07 * fbm1(t * 1.6, seed)
  const tasks = []

  // 1 · HTTP archive: many connections, completes on done0.
  {
    const size = 372 * MB
    const t0 = spawn(0)
    const P = (x) => curve((x - t0) / (done0 - t0))
    const p = P(t)
    const v = t < done0 ? (Math.max(0, P(t + 0.05) - P(t - 0.05)) / 0.1) * size * jitter(1) : 0
    const done = t >= done0
    tasks.push({
      id: 'http',
      name: 'blender-4.5.3-linux-x64.tar.xz',
      appear: prog(t, spawn(0) - 0.05, 0.45),
      actions: done ? ACT.complete : ACT.active,
      badge: done ? { label: s('ui.complete'), tone: 'success', icon: 'checkCircle' } : null,
      badgeK: slot(t, done0),
      progress: p,
      color: done ? 'success' : 'primary',
      active: !done,
      left: `${pct(p)}% · ${bytes(size * p, 2)} / ${bytes(size, 2)}`,
      right: done
        ? null
        : {
            remaining: remaining(s, ((1 - p) * size) / Math.max(v, 1)),
            down: `${bytes(v)}/s`,
            conns: Math.round(lerp(6, 48, smoothRamp((t - t0) / 1.6))),
          },
      speed: v,
    })
  }

  // 2 · SFTP from a NAS: steady, keeps going.
  {
    const size = 2.37 * 1024 * MB
    const t0 = spawn(1)
    const v = 18.6 * MB * smoothRamp((t - t0) / 1.2) * jitter(2)
    const p = clamp((Math.max(0, t - t0 - 0.3) * 18.6 * MB) / size, 0, 0.97)
    tasks.push({
      id: 'sftp',
      name: 'photos-2026.tar',
      appear: prog(t, spawn(1) - 0.05, 0.45),
      actions: ACT.active,
      progress: p,
      color: 'primary',
      active: true,
      left: `${pct(p)}% · ${bytes(size * p, 2)} / ${bytes(size, 2)}`,
      right: { remaining: remaining(s, ((1 - p) * size) / Math.max(v, 1)), down: `${bytes(v)}/s`, conns: 4 },
      speed: v,
    })
  }

  // 3 · Magnet → metadata → BitTorrent pieces → seeding on done1.
  const btModel = (() => {
    const t0 = spawn(2)
    const meta = t0 + 1.35
    const P = (x) => smoothRamp((x - meta) / (done1 - meta)) * 0.985 + (x >= done1 ? 0.015 : 0)
    const p = t < meta ? 0 : P(t)
    const seeding = t >= done1
    const fetching = t < meta
    const v = fetching || seeding ? 0 : (Math.max(0, P(t + 0.05) - P(t - 0.05)) / 0.1) * BT.size * jitter(3)
    const up = seeding ? 2.4 * MB * jitter(4) : fetching ? 0 : 1.1 * MB * jitter(5) * smoothRamp((t - meta) / 1.5)
    const uploaded = fetching ? 0 : Math.max(0, t - meta) * 1.05 * MB
    const seeders = 41 + Math.round(4 * Math.sin(t * 0.8))
    const conns = fetching ? 3 : Math.round(lerp(12, 38, smoothRamp((t - meta) / 2)))
    // Piece map: quantised to sixteenth notes, so pieces land on the hi-hats.
    const step = T.spb / 4
    const tq = Math.floor(t / step) * step
    const q = tq < meta ? 0 : P(tq)
    const qPrev = tq - step < meta ? 0 : P(tq - step)
    const count = (qq, i) => {
      if (qq >= 1) return 4
      const a = (BT_ORDER[i] / BT.atoms) * 0.96
      return qq < a ? 0 : Math.min(4, Math.floor((qq - a) / 0.01) + 1)
    }
    const toStatus = [0, 1, 2, 3, 3]
    const flash = Math.exp(-(t - tq) * 7)
    const card = {
      id: 'bt',
      name: fetching ? 'bbb-4k60' : BT.name,
      appear: prog(t, spawn(2) - 0.05, 0.45),
      actions: seeding ? ACT.seeding : ACT.active,
      badge:
        fetching || t < meta + 0.42
          ? { label: s('ui.fetching'), tone: 'waiting', icon: 'radio' }
          : seeding
            ? { label: s('ui.seeding'), tone: 'success', icon: 'cloudUpload' }
            : null,
      badgeK: seeding ? slot(t, done1) : fetching ? 1 : 1 - M3.emphasized(prog(t, meta, 0.42)),
      sharing: M3.enter(prog(t, done1, 0.2)),
      progress: p,
      color: seeding ? 'success' : 'primary',
      active: true,
      left: fetching ? '' : `${pct(p)}% · ${bytes(BT.size * p, 2)} / ${bytes(BT.size, 2)}`,
      right: {
        remaining: fetching || seeding ? '' : remaining(s, ((1 - p) * BT.size) / Math.max(v, 1)),
        up: fetching ? null : `${bytes(up)}/s`,
        down: `${bytes(v)}/s`,
        seeders: fetching ? null : seeders,
        conns,
      },
      speed: v,
      up,
    }
    return {
      card,
      detail: {
        atoms: BT.atoms,
        progress: p,
        level: (i) => toStatus[count(q, i)],
        fresh: (i) => (count(q, i) > count(qPrev, i) ? flash : 0),
        rows: [
          [s('ui.d.progress'), '__progress__'],
          [
            s('ui.d.size'),
            `${bytes(BT.size * p, 2)} / ${bytes(BT.size, 2)}${seeding || fetching ? '' : `   ${remaining(s, ((1 - p) * BT.size) / Math.max(v, 1))}`}`,
          ],
          [s('ui.d.down'), `${bytes(v)}/s`],
          [s('ui.d.up'), `${bytes(up)}/s`],
          [s('ui.d.uploaded'), bytes(uploaded, 2)],
          [s('ui.d.ratio'), (uploaded / Math.max(1, BT.size * p)).toFixed(2)],
          [s('ui.d.seeders'), String(seeders)],
          [s('ui.conns'), String(conns)],
        ],
      },
    }
  })()
  tasks.push(btModel.card)

  // 4 · ED2K: slower sources, keeps going.
  {
    const size = 3.74 * 1024 * MB
    const t0 = spawn(3)
    const v = 5.3 * MB * smoothRamp((t - t0 - 0.4) / 1.6) * jitter(6)
    const p = clamp((Math.max(0, t - t0 - 0.8) * 5.3 * MB) / size)
    tasks.push({
      id: 'ed2k',
      name: 'debian-13.iso',
      appear: prog(t, spawn(3) - 0.05, 0.45),
      actions: ACT.active,
      progress: p,
      color: 'primary',
      active: true,
      left: p > 0 ? `${pct(p)}% · ${bytes(size * p, 2)} / ${bytes(size, 2)}` : '',
      right: {
        remaining: remaining(s, ((1 - p) * size) / Math.max(v, 1)),
        down: `${bytes(v)}/s`,
        conns: Math.round(lerp(2, 23, smoothRamp((t - t0) / 3))),
      },
      speed: v,
    })
  }

  // 5 · Live HLS: inspecting, then recording (indeterminate).
  {
    const t0 = spawn(4)
    const probe = t0 + 1.0
    const rec = Math.max(0, t - probe)
    const v = t < probe ? 0 : 1.45 * MB * jitter(7)
    tasks.push({
      id: 'live',
      name: 'keynote-live.mp4',
      appear: prog(t, spawn(4) - 0.05, 0.45),
      actions: t < probe ? ACT.active : ACT.recording,
      badge: { label: t < probe ? s('ui.probing') : s('ui.recording'), tone: 'waiting', icon: 'radio' },
      badgeK: 1,
      progress: null,
      active: true,
      left: t < probe ? '' : `${mediaDuration(rec)} / ${s('ui.live')}`,
      right: { down: `${bytes(v)}/s`, conns: 2 },
      speed: v,
    })
  }

  // 6 · From Rayburst Connect: VOD media, 03:12, downloading media.
  {
    const dur = 192
    const p = clamp(prog(t, arrive + 0.2, 26))
    const v = t < arrive ? 0 : 21.4 * MB * smoothRamp((t - arrive) / 0.8) * jitter(8)
    tasks.unshift({
      id: 'connect',
      name: `${s('connect.pageTitle')}.mkv`,
      insert: true,
      appear: prog(t, arrive, 0.55),
      actions: ACT.active,
      badge: { label: s('ui.mediaDownloading'), tone: 'waiting', icon: 'radio' },
      badgeK: 1,
      progress: p,
      color: 'primary',
      active: true,
      left: `${pct(p)}% · ${mediaDuration(dur * p)} / ${mediaDuration(dur)}`,
      right: { down: `${bytes(v)}/s`, conns: 6 },
      speed: v,
    })
  }

  const shown = tasks.filter((x) => (x.appear ?? 0) > 0)
  const completed = shown.filter((x) => x.badge?.tone === 'success' && x.id === 'http').length
  const down = shown.reduce((a, x) => a + (x.speed ?? 0), 0)
  const up = btModel.card.up + (shown.length ? 0.2 * MB * jitter(9) : 0)
  return {
    tasks,
    counts: { all: shown.length, progress: shown.length - completed, failed: 0, completed },
    speed: { up: bytes(up), down: bytes(down), active: shown.length > 0 },
    bt: btModel.detail,
    byId: Object.fromEntries(tasks.map((x) => [x.id, x])),
  }
}

export { fmt }
