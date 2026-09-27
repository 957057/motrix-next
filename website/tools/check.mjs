/**
 * Static checks for the website (node tools/check.mjs):
 *   - every text key the page or the scripts use exists in all 27 locales,
 *     every locale has the same keys and the same {placeholders}
 *   - the English written into index.html matches locales/en-US.json
 *   - headlines and slogans carry no terminal punctuation
 *   - every icon referenced has a symbol in the sprite
 *   - initial page assets stay local; the film uses an on-demand YouTube embed
 *     and assets stay within the size budget
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const errors = []
const warn = []
const err = (m) => errors.push(m)

function walk(dir, ext) {
  const out = []
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p, ext))
    else if (e.name.endsWith(ext)) out.push(p)
  }
  return out
}

const html = read('index.html')
const css = read('assets/css/style.css')
const scripts = walk('assets/js', '.js')
const js = Object.fromEntries(scripts.map((p) => [p, read(p)]))

// ── Keys in use ──────────────────────────────────────────────────────────
const used = new Set()
for (const m of html.matchAll(/data-i18n(?:-html|-alt|-aria-label|-title)?="([^"]+)"/g)) used.add(m[1])
for (const m of html.matchAll(/data-k="([^"]+)"/g)) used.add(m[1])
const KEY = /['"`]((?:ui|cx|tray|ov|proto|connect|details|d[123]|craft|dl|hero|features|theme|a11y|nav|rebrand|engine|ctl|footer)\.[\w.]*\w)['"`]/g
for (const src of Object.values(js)) {
  for (const m of src.matchAll(KEY)) used.add(m[1])
  for (const m of src.matchAll(/data-k="([\w.]+)"/g)) used.add(m[1])
}
for (const s of JSON.parse(read('assets/data/schemes.json'))) used.add(`scheme.${s.id}`)

// ── Locales ──────────────────────────────────────────────────────────────
const codes = readdirSync(join(ROOT, 'locales')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
if (codes.length !== 27) err(`expected 27 locales, found ${codes.length}`)
const locales = Object.fromEntries(codes.map((c) => [c, JSON.parse(read(`locales/${c}.json`))]))
const en = locales['en-US']
const enKeys = Object.keys(en).sort()
const holders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
for (const k of used) if (!(k in en)) err(`en-US: missing "${k}" (used by the page)`)
for (const k of enKeys) if (!used.has(k)) warn.push(`en-US: "${k}" is not used`)
for (const [code, loc] of Object.entries(locales)) {
  const keys = Object.keys(loc).sort()
  for (const k of enKeys) {
    if (!(k in loc)) err(`${code}: missing "${k}"`)
    else if (typeof loc[k] !== 'string' || !loc[k].trim()) err(`${code}: "${k}" is empty`)
    else if (holders(loc[k]) !== holders(en[k])) err(`${code}: "${k}" placeholders differ from English`)
  }
  for (const k of keys) if (!(k in en)) err(`${code}: extra key "${k}"`)
}

// ── English fallback in the page matches en-US.json ──────────────────────
const norm = (s) =>
  s
    .replace(/<[^>]+>/g, (tag) => (tag.startsWith('<code') || tag.startsWith('</code') || tag.startsWith('<a') || tag.startsWith('</a') ? tag : ''))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
for (const m of html.matchAll(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)<\/\1>/g)) {
  const [, , key, text] = m
  if (en[key] != null && norm(text) !== norm(en[key])) err(`index.html: English for "${key}" differs from en-US.json`)
}

// ── Punctuation ──────────────────────────────────────────────────────────
const HEADLINES = Object.keys(en).filter((k) => /(^|\.)(title|tagline|head[AB]|sub|chip|tag)$/.test(k) && !k.startsWith('features.'))
for (const [code, loc] of Object.entries(locales)) {
  for (const k of HEADLINES) if (/[.。!！]$/.test(loc[k] ?? '')) err(`${code}: "${k}" ends with punctuation`)
}

// ── Icons ────────────────────────────────────────────────────────────────
const symbols = new Set([...html.matchAll(/<symbol id="i-([\w-]+)"/g)].map((m) => m[1]))
const refs = new Set()
for (const m of html.matchAll(/#i-([\w-]+)/g)) refs.add(m[1])
for (const src of Object.values(js)) for (const m of src.matchAll(/['"`]((?:[a-z]+-)+outline|logo-(?:github|chrome|edge|firefox|docker|apple|windows|tux|android))['"`]/g)) refs.add(m[1])
for (const r of refs) if (!symbols.has(r)) err(`icon "${r}" has no symbol (run python3 tools/build-icons.py)`)

// ── Local assets only ────────────────────────────────────────────────────
for (const m of html.matchAll(/<(?:script|link|img|source|video|iframe)\b[^>]*\s(?:src|href|poster)="([^"]+)"/g)) {
  if (/^(https?:)?\/\//.test(m[1])) err(`index.html loads a remote resource: ${m[1]}`)
}
for (const m of css.matchAll(/url\(([^)]+)\)/g)) if (/^['"]?(https?:)?\/\//.test(m[1])) err(`style.css loads ${m[1]}`)
for (const [p, src] of Object.entries(js)) {
  for (const m of src.matchAll(/fetch\(\s*(['"`])(https?:[^'"`]+)\1/g)) err(`${p} fetches ${m[2]}`)
  for (const m of src.matchAll(/https:\/\/api\.[\w.]+/g)) if (!m[0].startsWith('https://api.github.com')) err(`${p} calls ${m[0]}`)
  if (/\bimport\s*\(|from\s+['"]https?:/.test(src)) err(`${p} imports remote code`)
}

// The official player is the only embedded origin. Runtime lifecycle checks
// belong in a browser; scanning source cannot prove click-only network access.
for (const [p, src] of Object.entries(js)) {
  for (const match of src.matchAll(/https:\/\/[^\s'"`]+\/embed\//g)) {
    if (match[0] !== 'https://www.youtube-nocookie.com/embed/') err(`${p} uses an unexpected embed origin: ${match[0]}`)
  }
}

// ── Budget ───────────────────────────────────────────────────────────────
const size = (p) => statSync(join(ROOT, p)).size
const jsBytes = scripts.reduce((n, p) => n + size(p), 0)
const budget = [
  ['JavaScript', jsBytes, 140_000],
  ['CSS', size('assets/css/style.css'), 100_000],
  ['index.html', size('index.html'), 80_000],
]
for (const [name, bytes, max] of budget) if (bytes > max) err(`${name} is ${bytes} bytes (budget ${max})`)
// Cloudflare Pages serves files up to 25 MiB.
for (const p of walk('assets', '')) if (size(p) > 25 * 1024 * 1024) err(`${p} is over 25 MiB, the Cloudflare Pages file limit`)

// ── Report ───────────────────────────────────────────────────────────────
for (const w of warn) console.log(`  warn  ${w}`)
if (errors.length) {
  for (const e of errors) console.log(`  ✗ ${e}`)
  console.log(`\n${errors.length} problem(s)`)
  process.exit(1)
}
console.log(`✓ ${used.size} text keys in use, ${enKeys.length} per locale, ${codes.length} locales in parity`)
console.log(`✓ page English matches en-US.json; headlines carry no terminal punctuation`)
console.log(`✓ ${refs.size} icons referenced, all in the sprite`)
console.log(`✓ initial assets local; ${budget.map(([n, b]) => `${n} ${(b / 1024).toFixed(1)} KB`).join(', ')}`)
