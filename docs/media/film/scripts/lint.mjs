#!/usr/bin/env node
/**
 * Static checks, no browser needed:
 *  - timeline.json: sections contiguous, drum bars match, chords per bar, events in range
 *  - every sfx in timeline.json has a synth in audio/soundtrack.py (fx_<name>)
 *  - every scene exists for every section
 *  - every locale has exactly the English key set; slogans/headlines carry no terminal punctuation
 *  - every T.ev('…') and s('…') literal used in scenes exists
 *  - no wall-clock or random sources in the film code (frames must be deterministic)
 *  - interface strings (ui.*, cx.*) match the real apps' locale files word for
 *    word, when the Rayburst repos are next to this project (or RAYBURST_LAB
 *    points at them): the film must never show UI text the product doesn't have
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ROOT } from './serve.mjs'

const errors = []
const warn = []
const err = (m) => errors.push(m)

const tl = JSON.parse(readFileSync(join(ROOT, 'timeline.json'), 'utf8'))
const totalBeats = tl.bars * tl.beatsPerBar

// Timeline
let cursor = 0
for (const s of tl.sections) {
  if (s.beat !== cursor) err(`section ${s.id} starts at beat ${s.beat}, expected ${cursor}`)
  if (s.beats % tl.beatsPerBar) err(`section ${s.id} is not a whole number of bars`)
  if (s.drums.length !== s.beats / tl.beatsPerBar)
    err(`section ${s.id}: ${s.drums.length} drum bars for ${s.beats / tl.beatsPerBar} bars`)
  for (const p of s.drums) if (!tl.patterns[p]) err(`section ${s.id}: unknown pattern ${p}`)
  cursor = s.beat + s.beats
}
if (cursor !== totalBeats) err(`sections cover ${cursor} beats, timeline has ${totalBeats}`)
if (tl.chords.length !== tl.bars) err(`${tl.chords.length} chords for ${tl.bars} bars`)
for (const [id, e] of Object.entries(tl.events)) {
  if (e.beat < 0 || e.beat > totalBeats) err(`event ${id} at beat ${e.beat} is outside the song`)
}

// Sound effects vs synth
const py = readFileSync(join(ROOT, 'audio', 'soundtrack.py'), 'utf8')
const synths = new Set([...py.matchAll(/def fx_(\w+)\(/g)].map((m) => m[1]))
for (const [id, e] of Object.entries(tl.events))
  if (e.sfx && !synths.has(e.sfx)) err(`event ${id}: no fx_${e.sfx} in soundtrack.py`)
const modes = new Set([...py.matchAll(/mode == "(\w+)"/g)].map((m) => m[1]))
for (const s of tl.sections)
  if (!modes.has(s.music)) err(`section ${s.id}: music mode "${s.music}" not handled in soundtrack.py`)

// Scenes
const { scenes } = await import('../src/scenes/index.js')
const ids = new Set(scenes.map((s) => s.id))
for (const s of tl.sections) if (!ids.has(s.id)) err(`no scene for section ${s.id}`)

// Locales
const { LOCALES } = await import('../src/i18n/index.js')
const en = LOCALES.en.strings
const enKeys = Object.keys(en).sort()
const NO_END_PUNCT =
  /^(slogan|wait\.headline|proto\.(head|http|sftp|bt|magnet|ed2k|media)$|connect\.head[AB]$|craft\.(theme|schemes|langs|native|privacy|open)$|app\.c\d\.title|engine\.tag)/
for (const [code, pack] of Object.entries(LOCALES)) {
  const keys = Object.keys(pack.strings).sort()
  for (const k of enKeys) if (!(k in pack.strings)) err(`${code}: missing key ${k}`)
  for (const k of keys) if (!(k in en)) err(`${code}: extra key ${k}`)
  for (const [k, v] of Object.entries(pack.strings)) {
    if (typeof v !== 'string' || !v.trim()) err(`${code}: empty string ${k}`)
    if (NO_END_PUNCT.test(k) && /[.。!！?？]$/.test(v)) err(`${code}: "${k}" ends with punctuation (brand rule)`)
  }
}
if (LOCALES['zh-CN'].strings.slogan !== '重新定义开源下载器')
  err('zh-CN slogan must be the approved 重新定义开源下载器')
if (en.slogan !== 'Redefining the open-source download manager') err('en slogan must be the approved English slogan')

// Interface strings against the real products
const UI_SOURCE = {
  'ui.tasks': 'app.task-list',
  'ui.all': 'task.scope-all',
  'ui.progress': 'task.scope-progress',
  'ui.failed': 'task.scope-failed',
  'ui.completed': 'task.scope-completed',
  'ui.about': 'navigation.about',
  'ui.settings': 'navigation.settings',
  'ui.remaining': 'task.remaining-prefix',
  'ui.h': 'app.hour',
  'ui.m': 'app.minute',
  'ui.s': 'app.second',
  'ui.complete': 'task.task-complete',
  'ui.seeding': 'task.seeding',
  'ui.fetching': 'task.bt-metadata-fetching',
  'ui.probing': 'media.probing',
  'ui.mediaDownloading': 'media.downloading',
  'ui.recording': 'media.recording',
  'ui.live': 'media.live',
  'ui.saved': 'task.download-complete-message',
  'ui.seedingToast': 'task.bt-download-complete-message',
  'ui.openFile': 'task.open-file',
  'ui.showInFolder': 'task.show-in-folder',
  'ui.detail': 'task.task-detail-title',
  'ui.tab.general': 'task.task-tab-general',
  'ui.tab.activity': 'task.task-tab-activity',
  'ui.tab.files': 'task.task-tab-files',
  'ui.tab.peers': 'task.task-tab-peers',
  'ui.tab.trackers': 'task.task-tab-trackers',
  'ui.d.progress': 'task.task-progress-info',
  'ui.d.size': 'task.task-file-size',
  'ui.d.down': 'task.task-download-speed',
  'ui.d.up': 'task.task-upload-speed',
  'ui.d.uploaded': 'task.task-upload-length',
  'ui.d.ratio': 'task.task-ratio',
  'ui.d.seeders': 'task.task-num-seeders',
  'ui.conns': 'task.task-connections',
  'ui.newTask': 'task.new-task',
  'ui.tabUri': 'task.uri-task',
  'ui.tabTorrent': 'task.torrent-task',
  'ui.uriTips': 'task.uri-task-tips',
  'ui.rename': 'task.task-out',
  'ui.optional': 'task.task-out-tips',
  'ui.saveTo': 'task.task-dir',
  'ui.advanced': 'task.show-advanced-options',
  'ui.cancel': 'app.cancel',
  'ui.create': 'task.create',
  'cx.connected': 'popup_status_connected',
  'cx.intercepting': 'popup_toggle_enabled',
  'cx.downloads': 'media_downloads',
  'cx.sniffer': 'sniffer_tab',
  'cx.current': 'resources_current',
  'cx.filter': 'media_filter',
  'cx.all': 'resources_all',
  'cx.time': 'resources_time',
  'cx.fileKind': 'resources_kind_file',
  'cx.subsKind': 'resources_kind_subtitle',
  'cx.back': 'media_back',
  'cx.key': 'resources_key',
  'cx.manifest': 'resources_manifest',
  'cx.sizeUnknown': 'media_size_unknown',
  'cx.loading': 'media_loading',
  'cx.confirming': 'media_confirming',
  'cx.video': 'media_video',
  'cx.audio': 'media_audio',
  'cx.subs': 'media_subtitles',
  'cx.format': 'media_format',
  'cx.start': 'resources_start_time',
  'cx.end': 'resources_end_time',
  'cx.cancel': 'media_cancel',
  'cx.download': 'media_download',
  'cx.submitted': 'media_submitted',
}
// Not from the apps' own bundles: Naive UI's pager label and track labels (data).
const UI_EXEMPT = new Set(['ui.perPage', 'cx.audioVal', 'cx.subsVal'])
const LAB = process.env.RAYBURST_LAB ? resolve(process.env.RAYBURST_LAB) : resolve(ROOT, '../../../..')
const APP_LOCALE = { en: 'en-US', 'zh-CN': 'zh-CN' }
const CX_LOCALE = { en: 'en', 'zh-CN': 'zh_CN' }
let uiChecked = 0
for (const k of Object.keys(en)) {
  if ((k.startsWith('ui.') || k.startsWith('cx.')) && !UI_EXEMPT.has(k) && !UI_SOURCE[k])
    err(`${k}: no source key in the real app (add it to UI_SOURCE or UI_EXEMPT)`)
}
if (existsSync(join(LAB, 'rayburst')) && existsSync(join(LAB, 'rayburst-connect'))) {
  for (const [code, pack] of Object.entries(LOCALES)) {
    const appFile = join(LAB, 'rayburst', 'src', 'shared', 'locales', APP_LOCALE[code] ?? code, 'messages.json')
    const cxFile = join(
      LAB,
      'rayburst-connect',
      'public',
      '_locales',
      CX_LOCALE[code] ?? code.replace('-', '_'),
      'messages.json',
    )
    if (!existsSync(appFile) || !existsSync(cxFile)) {
      warn.push(`${code}: real locale files not found, UI strings unchecked`)
      continue
    }
    const app = JSON.parse(readFileSync(appFile, 'utf8'))
    const cx = JSON.parse(readFileSync(cxFile, 'utf8'))
    for (const [k, src] of Object.entries(UI_SOURCE)) {
      const real = k.startsWith('cx.') ? cx[src]?.message : src.split('.').reduce((o, part) => o?.[part], app)
      const ours = pack.strings[k]
      if (real == null) err(`${code} ${k}: source ${src} missing in the real locale`)
      else if (String(real).replace('{taskName}', '{name}') !== ours)
        err(`${code} ${k}: "${ours}" but the app says "${real}"`)
      else uiChecked++
    }
  }
} else {
  warn.push(`Rayburst repos not found at ${LAB}; UI strings not compared (set RAYBURST_LAB to check)`)
}

// Source scans
const srcDir = join(ROOT, 'src')
const files = []
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(d, e.name))
    else if (e.name.endsWith('.js')) files.push(join(d, e.name))
  }
}
walk(srcDir)
for (const f of files) {
  const code = readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const rel = f.slice(ROOT.length + 1)
  if (!rel.endsWith('player.js') && /Math\.random|Date\.now|performance\.now/.test(code))
    err(`${rel}: non-deterministic source (Math.random / Date.now / performance.now)`)
  for (const m of code.matchAll(/T\.ev\('([\w]+)'\)/g)) if (!tl.events[m[1]]) err(`${rel}: unknown event '${m[1]}'`)
  for (const m of code.matchAll(/\bs\('([\w.]+)'\)/g)) if (!(m[1] in en)) err(`${rel}: unknown string '${m[1]}'`)
  for (const m of code.matchAll(/T\.section\('([\w]+)'\)/g))
    if (!ids.has(m[1])) err(`${rel}: unknown section '${m[1]}'`)
}

if (warn.length) console.log(warn.map((w) => `! ${w}`).join('\n'))
if (errors.length) {
  console.log(errors.map((e) => `✗ ${e}`).join('\n'))
  console.log(`\n${errors.length} problem(s)`)
  process.exit(1)
}
console.log(
  `✓ timeline: ${tl.sections.length} sections, ${Object.keys(tl.events).length} events, ${totalBeats} beats (${(totalBeats * 60) / tl.bpm}s)`,
)
console.log(`✓ sfx: ${synths.size} synths cover every cue`)
console.log(`✓ scenes: ${scenes.length}`)
console.log(`✓ locales: ${Object.keys(LOCALES).join(', ')} (${enKeys.length} keys each)`)
console.log(`✓ ${files.length} source files deterministic`)
if (uiChecked) console.log(`✓ ${uiChecked} interface strings match the real Rayburst / Rayburst Connect locales`)
