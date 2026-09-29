/**
 * Static checks for the website (pnpm check):
 *   - every text key the components use exists in en-US; every locale has the
 *     same keys, no empty values and the same {placeholders}
 *   - headlines and slogans carry no terminal punctuation
 *   - the pages load only local assets; the film uses the privacy-enhanced embed
 *   - after `pnpm build`, the page stays within its size budget
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const errors = []
const warn = []
const err = (m) => errors.push(m)

function walk(dir, test) {
  const out = []
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p, test))
    else if (test(e.name)) out.push(p)
  }
  return out
}

function flatten(node, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = v
  }
  return out
}

// ── Locales ──────────────────────────────────────────────────────────────
const codes = readdirSync(join(ROOT, 'src/locales'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
if (codes.length !== 27) err(`expected 27 locales, found ${codes.length}`)
const locales = Object.fromEntries(codes.map((c) => [c, flatten(JSON.parse(read(`src/locales/${c}.json`)))]))
const en = locales['en-US']
const enKeys = Object.keys(en).sort()
const holders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',')
for (const [code, loc] of Object.entries(locales)) {
  for (const k of enKeys) {
    if (!(k in loc)) err(`${code}: missing "${k}"`)
    else if (typeof loc[k] !== 'string' || !loc[k].trim()) err(`${code}: "${k}" is empty`)
    else if (holders(loc[k]) !== holders(en[k])) err(`${code}: "${k}" placeholders differ from English`)
  }
  for (const k of Object.keys(loc)) if (!(k in en)) err(`${code}: extra key "${k}"`)
}

// ── Keys in use ──────────────────────────────────────────────────────────
// Literal keys and key prefixes (for keys completed at runtime, like `${p.key}.t`).
// Source strings use single quotes or backticks; double quotes delimit Vue attributes.
const sources = Object.fromEntries(walk('src', (n) => /\.(vue|ts)$/.test(n)).map((p) => [p, read(p)]))
const NAMESPACES = [...new Set(enKeys.map((k) => k.split('.')[0]))].join('|')
const LITERAL = new RegExp(`['\`]((?:${NAMESPACES})(?:\\.[\\w-]+)*)(?:['\`]|\\.\\$\\{)`, 'g')
const refs = new Set()
for (const src of Object.values(sources)) for (const m of src.matchAll(LITERAL)) refs.add(m[1])
for (const m of read('src/data/schemes.ts').matchAll(/\{ id: '(\w+)', seed:/g)) refs.add(`scheme.${m[1]}`)
const isBranch = (ref) => enKeys.some((k) => k.startsWith(`${ref}.`))
for (const ref of refs) {
  if (ref.includes('.') && !(ref in en) && !isBranch(ref)) err(`en-US: missing "${ref}" (used in src)`)
}
const covered = (k) => refs.has(k) || [...refs].some((r) => k.startsWith(`${r}.`))
for (const k of enKeys) if (!covered(k)) warn.push(`en-US: "${k}" looks unused`)

// ── Punctuation ──────────────────────────────────────────────────────────
const HEADLINES = enKeys.filter(
  (k) => /(^|\.)(title|tagline|head[AB]|sub|chip|tag)$/.test(k) && !k.startsWith('features.'),
)
for (const [code, loc] of Object.entries(locales)) {
  for (const k of HEADLINES) if (/[.。!！]$/.test(loc[k] ?? '')) err(`${code}: "${k}" ends with punctuation`)
}

// ── Local assets only ────────────────────────────────────────────────────
for (const page of ['index.html', '404.html']) {
  for (const m of read(page).matchAll(
    /<(?:script|link|img|source|video|iframe)\b[^>]*\s(?:src|href|poster)="([^"]+)"/g,
  )) {
    if (/^(https?:)?\/\//.test(m[1])) err(`${page} loads a remote resource: ${m[1]}`)
  }
}
for (const [p, src] of Object.entries(sources)) {
  for (const m of src.matchAll(/url\((['"]?)(https?:)?\/\//g)) err(`${p} loads a remote url(): ${m[0]}`)
  for (const m of src.matchAll(/https:\/\/api\.[\w.]+/g)) {
    if (m[0] !== 'https://api.github.com') err(`${p} calls ${m[0]}`)
  }
  for (const m of src.matchAll(/https:\/\/[^\s'"`]+\/embed\//g)) {
    if (m[0] !== 'https://www.youtube-nocookie.com/embed/') err(`${p} uses an unexpected embed origin: ${m[0]}`)
  }
}

// ── Budget (after pnpm build) ────────────────────────────────────────────
const budget = []
if (existsSync(join(ROOT, 'dist/assets'))) {
  const assets = walk('dist', () => true)
  const locale = new RegExp(`/(?:${codes.join('|')})-[\\w-]+\\.js$`)
  const gz = (files) => files.reduce((n, p) => n + gzipSync(readFileSync(join(ROOT, p))).length, 0)
  const js = assets.filter((p) => p.endsWith('.js') && !locale.test(p.replaceAll('\\', '/')))
  const css = assets.filter((p) => p.endsWith('.css'))
  budget.push(['JavaScript (gzip)', gz(js), 240_000], ['CSS (gzip)', gz(css), 40_000])
  for (const [name, bytes, max] of budget) if (bytes > max) err(`${name} is ${bytes} bytes (budget ${max})`)
}

// ── Report ───────────────────────────────────────────────────────────────
for (const w of warn) console.log(`  warn  ${w}`)
if (errors.length) {
  for (const e of errors) console.log(`  ✗ ${e}`)
  console.log(`\n${errors.length} problem(s)`)
  process.exit(1)
}
console.log(`✓ ${enKeys.length} keys per locale, ${codes.length} locales in parity; every key in use exists`)
console.log('✓ headlines carry no terminal punctuation; pages load local assets only')
if (budget.length) console.log(`✓ ${budget.map(([n, b]) => `${n} ${(b / 1024).toFixed(1)} KB`).join(', ')}`)
else console.log('  (run pnpm build to check the size budget)')
