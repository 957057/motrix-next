/**
 * @fileoverview The demo tasks, as pure functions of time. Card states,
 * badges, action sets and info rows follow Rayburst's useTaskCardModel,
 * TaskItem and TaskItemActions:
 *   - plain active downloads carry no badge;
 *   - metadata fetching and media states use the info (waiting) tone;
 *   - completed and seeding use success; seeding also turns the left border;
 *   - live media is indeterminate: no progress bar, "HH:MM:SS / Live";
 *   - the right side of the info row shows only while a task is active.
 * Speeds are illustrative but plausible.
 */
import type { Translate } from '@/i18n'
import { clamp, lerp, noise, smoothstep } from '@/motion/gsap'
import type { IconName } from '@/ui/icons'
import { bytes, clock, MB, pct, remaining } from './format'

export const LINKS = {
  http: 'https://download.blender.org/release/Blender4.5/blender-4.5.3-linux-x64.tar.xz',
  sftp: 'sftp://nas.local/backup/photos-2026.tar',
  magnet: 'magnet:?xt=urn:btih:9c4e2b7d1a0f53e8b6d2c1a7f0e39d84b5c6a217&dn=bbb-4k60',
  ed2k: 'ed2k://|file|debian-13.iso|4011851776|4A7C1F2E9B03D6C58E21F0A7B3D94C61|/',
  live: 'https://live.example.com/keynote-live.m3u8',
}

export const BT = { atoms: 642, size: 642 * MB, name: 'bbb_sunflower_2160p_60fps_normal.mp4' }

const ACTIONS = {
  active: ['pause-outline', 'folder-open-outline', 'link-outline', 'information-circle-outline', 'close-outline'],
  complete: [
    'open-outline',
    'folder-open-outline',
    'refresh-outline',
    'link-outline',
    'information-circle-outline',
    'trash-outline',
  ],
  seeding: [
    'pause-outline',
    'stop-circle-outline',
    'folder-open-outline',
    'link-outline',
    'information-circle-outline',
    'close-outline',
  ],
  recording: [
    'stop-circle-outline',
    'pause-outline',
    'folder-open-outline',
    'link-outline',
    'information-circle-outline',
    'close-outline',
  ],
} satisfies Record<string, IconName[]>

export type Tone = 'primary' | 'success' | 'info'
export type TaskId = 'http' | 'sftp' | 'ed2k' | 'bt' | 'live' | 'media'

export interface Badge {
  text: string
  tone: Tone
  icon: IconName
}

export interface InfoRight {
  remaining?: string
  up?: string | null
  down?: string
  seeders?: number | null
  conns?: number
}

export interface TorrentDetail {
  progress: number
  seeders: number
  conns: number
  up: number
  v: number
  uploaded: number
}

export interface TaskView {
  id: TaskId
  name: string
  actions: IconName[]
  badge: Badge | null
  /** 0..1, or null for indeterminate (live) tasks. */
  progress: number | null
  tone: Tone
  active: boolean
  sharing?: boolean
  left: string
  right: InfoRight | null
  speed: number
  up: number
  /** Scene time at which the task completed (for toasts). */
  doneAt?: number | null
  /** Recording position in seconds (live tasks). */
  rec?: number
  detail?: TorrentDetail
}

export type TaskFactory = (t: number, tr: Translate) => TaskView | null

const jitter = (t: number, seed: number) => 1 + 0.08 * noise(t * 1.3, seed)
const eta = (tr: Translate, left: number, v: number) => (v > 0 ? remaining(tr, left / v) : '')
const sizeLine = (p: number, size: number) => `${pct(p)}% · ${bytes(size * p, 2)} / ${bytes(size, 2)}`

interface FileOptions {
  id: TaskId
  name: string
  size: number
  at: number
  p0: number
  /** bytes per second */
  rate: number
  conns: [number, number]
  seed: number
}

/** A file download with a known size. */
function file(o: FileOptions): TaskFactory {
  return (t, tr) => {
    const age = t - o.at
    if (age < 0) return null
    const p = clamp((o.p0 * o.size + o.rate * Math.max(0, age - 0.3)) / o.size)
    const done = p >= 1
    const v = done ? 0 : o.rate * jitter(t, o.seed) * smoothstep(age / 1.2)
    return {
      id: o.id,
      name: o.name,
      actions: done ? ACTIONS.complete : ACTIONS.active,
      badge: done ? { text: tr('ui.complete'), tone: 'success', icon: 'checkmark-circle-outline' } : null,
      progress: p,
      tone: done ? 'success' : 'primary',
      active: !done,
      left: sizeLine(p, o.size),
      right: done
        ? null
        : {
            remaining: eta(tr, (1 - p) * o.size, v),
            down: `${bytes(v)}/s`,
            conns: Math.round(lerp(o.conns[0], o.conns[1], smoothstep(age / 1.8))),
          },
      speed: v,
      up: 0,
      doneAt: done ? o.at + (o.size * (1 - o.p0)) / o.rate + 0.3 : null,
    }
  }
}

/** Magnet → metadata → pieces → seeding. */
function torrent(at: number, p0: number, dur: number, meta: number): TaskFactory {
  return (t, tr) => {
    const age = t - at
    if (age < 0) return null
    const fetching = age < meta
    const run = Math.max(0, age - meta)
    const x = clamp(run / dur)
    const p = fetching ? 0 : p0 + (1 - p0) * x
    const seeding = !fetching && x >= 1
    const v = fetching || seeding ? 0 : (((1 - p0) * BT.size) / dur) * jitter(t, 3)
    const up = seeding ? 2.4 * MB * jitter(t, 4) : fetching ? 0 : 1.1 * MB * jitter(t, 5) * smoothstep(run / 1.5)
    const seeders = 41 + Math.round(4 * Math.sin(t * 0.8))
    const conns = fetching ? 3 : Math.round(lerp(12, 38, smoothstep(run / 2)))
    return {
      id: 'bt',
      name: fetching ? 'bbb-4k60' : BT.name,
      actions: seeding ? ACTIONS.seeding : ACTIONS.active,
      badge: fetching
        ? { text: tr('ui.fetching'), tone: 'info', icon: 'radio-outline' }
        : seeding
          ? { text: tr('ui.seeding'), tone: 'success', icon: 'cloud-upload-outline' }
          : null,
      sharing: seeding,
      progress: seeding ? 1 : p,
      tone: seeding ? 'success' : 'primary',
      active: true,
      left: fetching ? '' : sizeLine(seeding ? 1 : p, BT.size),
      right: {
        remaining: fetching || seeding ? '' : eta(tr, (1 - p) * BT.size, v),
        up: fetching ? null : `${bytes(up)}/s`,
        down: `${bytes(v)}/s`,
        seeders: fetching ? null : seeders,
        conns,
      },
      speed: v,
      up,
      doneAt: seeding ? at + meta + dur : null,
      detail: { progress: seeding ? 1 : p, seeders, conns, up, v, uploaded: run * 1.05 * MB },
    }
  }
}

/** Live HLS: probing, then recording (indeterminate). */
function live(at: number, from: number): TaskFactory {
  return (t, tr) => {
    const age = t - at
    if (age < 0) return null
    const probing = age < 1
    const v = probing ? 0 : 1.45 * MB * jitter(t, 7)
    return {
      id: 'live',
      name: 'keynote-live.mp4',
      actions: probing ? ACTIONS.active : ACTIONS.recording,
      badge: { text: tr(probing ? 'ui.probing' : 'ui.recording'), tone: 'info', icon: 'radio-outline' },
      progress: null,
      tone: 'primary',
      active: true,
      left: probing ? '' : `${clock(from + age - 1)} / ${tr('ui.live')}`,
      right: { down: `${bytes(v)}/s`, conns: 2 },
      speed: v,
      up: 0,
      rec: probing ? 0 : from + age - 1,
    }
  }
}

/** On-demand media from Rayburst Connect. */
function media(at: number, p0: number, name: (tr: Translate) => string): TaskFactory {
  const dur = 192
  return (t, tr) => {
    const age = t - at
    if (age < 0) return null
    const p = clamp(p0 + age / 40)
    const done = p >= 1
    const v = done ? 0 : 21.4 * MB * smoothstep(age / 0.8) * jitter(t, 8)
    return {
      id: 'media',
      name: name(tr),
      actions: done ? ACTIONS.complete : ACTIONS.active,
      badge: done
        ? { text: tr('ui.complete'), tone: 'success', icon: 'checkmark-circle-outline' }
        : { text: tr('ui.mediaDownloading'), tone: 'info', icon: 'radio-outline' },
      progress: p,
      tone: done ? 'success' : 'primary',
      active: !done,
      left: `${pct(p)}% · ${clock(dur * p)} / ${clock(dur)}`,
      right: done ? null : { down: `${bytes(v)}/s`, conns: 6 },
      speed: v,
      up: 0,
    }
  }
}

/** The media task Rayburst Connect sends: the demo page's title, saved as MKV. */
export const pageMedia = (tr: Translate) => `${tr('connect.pageTitle')}.mkv`

export const KINDS = {
  http: (at: number, p0 = 0, rate = 31 * MB) =>
    file({ id: 'http', name: 'blender-4.5.3-linux-x64.tar.xz', size: 372 * MB, at, p0, rate, conns: [6, 48], seed: 1 }),
  sftp: (at: number, p0 = 0) =>
    file({
      id: 'sftp',
      name: 'photos-2026.tar',
      size: 2.37 * 1024 * MB,
      at,
      p0,
      rate: 18.6 * MB,
      conns: [4, 4],
      seed: 2,
    }),
  ed2k: (at: number, p0 = 0) =>
    file({
      id: 'ed2k',
      name: 'debian-13.iso',
      size: 3.74 * 1024 * MB,
      at,
      p0,
      rate: 5.3 * MB,
      conns: [2, 23],
      seed: 6,
    }),
  bt: (at: number, p0 = 0, dur = 16, meta = 1.4) => torrent(at, p0, dur, meta),
  live: (at: number, from = 0) => live(at, from),
  media: (at: number, p0: number, name: (tr: Translate) => string = pageMedia) => media(at, p0, name),
}

export interface SceneFrame {
  tasks: TaskView[]
  byId: Partial<Record<TaskId, TaskView>>
  counts: { all: number; progress: number; failed: number; completed: number }
  speed: { up: number; down: number; active: boolean }
}

/**
 * A list of tasks built from factories; the result maps (t, tr) to the visible
 * cards (newest first when `newestFirst`), sidebar counts and the speedometer.
 */
export function scenario(list: TaskFactory[], { newestFirst = false } = {}) {
  return (t: number, tr: Translate): SceneFrame => {
    let tasks = list.map((f) => f(t, tr)).filter((x): x is TaskView => x !== null)
    if (newestFirst) tasks = tasks.reverse()
    const completed = tasks.filter((x) => x.badge?.tone === 'success' && !x.sharing).length
    const down = tasks.reduce((a, x) => a + x.speed, 0)
    const up = tasks.reduce((a, x) => a + x.up, 0) + (tasks.length ? 0.2 * MB * jitter(t, 9) : 0)
    return {
      tasks,
      byId: Object.fromEntries(tasks.map((x) => [x.id, x])),
      counts: { all: tasks.length, progress: tasks.length - completed, failed: 0, completed },
      speed: { up, down, active: tasks.length > 0 },
    }
  }
}

export interface Toast {
  id: string
  text: string
}

const TOAST_TIME = 4.5

/** Completion toasts for tasks that finished within the last few seconds. */
export function toastsFor(frame: SceneFrame, time: number, tr: Translate): Toast[] {
  const out: Toast[] = []
  for (const task of frame.tasks) {
    if (task.doneAt == null) continue
    const age = time - task.doneAt
    if (age < 0 || age > TOAST_TIME) continue
    out.push({
      id: `${task.id}:${task.sharing ? 'seed' : 'done'}`,
      text: tr(task.sharing ? 'ui.seedingToast' : 'ui.saved', { name: task.name }),
    })
  }
  return out
}
