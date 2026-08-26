#!/usr/bin/env node
/**
 * Repo-integrity checks that are NOT unit tests: they scan source and locale
 * files on disk to catch cross-cutting drift. Run in CI (see ci.yml), kept out
 * of the vitest suite so unit tests stay fast and don't break on asset edits.
 *
 * Checks:
 *   1. Locale parity   — every locale defines exactly the en-US key set.
 *   2. i18n usage       — every literal t('ns.key') in source exists in en-US.
 *   3. Dead locale keys — every en-US key is referenced by source or an explicit
 *                         dynamic-key contract.
 *
 * Exits non-zero with a readable report on the first category that fails.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'src')
const LOCALES_DIR = join(SRC_DIR, 'shared', 'locales')

const problems = []

// ── 1. Locale key parity ────────────────────────────────────────────

function extractLocaleKeys(filePath) {
  return new Set(extractLocaleKeyList(filePath))
}

function extractLocaleKeyList(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const quoted = Array.from(content.matchAll(/^\s*'([^']+)'\s*:/gm), (m) => m[1])
  const bare = Array.from(content.matchAll(/^\s*([A-Za-z_$][\w$-]*)\s*:/gm), (m) => m[1])
  return [...quoted, ...bare]
}

const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const namespaces = readdirSync(join(LOCALES_DIR, 'en-US'))
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .map((f) => f.replace(/\.js$/, ''))

for (const namespace of namespaces) {
  for (const locale of locales) {
    const filePath = join(LOCALES_DIR, locale, `${namespace}.js`)
    let keys
    try {
      keys = extractLocaleKeyList(filePath)
    } catch {
      continue
    }
    const seen = new Set()
    const duplicates = new Set()
    for (const key of keys) {
      if (seen.has(key)) duplicates.add(key)
      seen.add(key)
    }
    if (duplicates.size) problems.push(`locale ${locale}/${namespace}.js duplicate keys: ${[...duplicates].join(', ')}`)
  }
}

for (const namespace of namespaces) {
  const reference = extractLocaleKeys(join(LOCALES_DIR, 'en-US', `${namespace}.js`))
  for (const locale of locales) {
    if (locale === 'en-US') continue
    const filePath = join(LOCALES_DIR, locale, `${namespace}.js`)
    let keys
    try {
      keys = extractLocaleKeys(filePath)
    } catch {
      problems.push(`locale ${locale} is missing namespace file ${namespace}.js`)
      continue
    }
    const missing = [...reference].filter((k) => !keys.has(k))
    const extra = [...keys].filter((k) => !reference.has(k))
    if (missing.length) problems.push(`locale ${locale}/${namespace}.js missing keys: ${missing.join(', ')}`)
    if (extra.length) problems.push(`locale ${locale}/${namespace}.js extra keys: ${extra.join(', ')}`)
  }
}

// ── 2. i18n literal-key usage ───────────────────────────────────────

function walkSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walkSourceFiles(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

const namespaceKeys = new Map(namespaces.map((ns) => [ns, extractLocaleKeys(join(LOCALES_DIR, 'en-US', `${ns}.js`))]))
const callRe = /(?:\b\w+\.)?\bt\(\s*(['"])([A-Za-z0-9_-]+)\.([A-Za-z0-9_.-]+)\1/g
const referencedKeys = new Map(namespaces.map((namespace) => [namespace, new Set()]))

function recordReference(fullKey) {
  const separator = fullKey.indexOf('.')
  if (separator < 1) return
  const namespace = fullKey.slice(0, separator)
  const key = fullKey.slice(separator + 1)
  referencedKeys.get(namespace)?.add(key)
}

// Record locale keys held in typed maps, component metadata and return values,
// not just direct t() calls. Only known namespaces are accepted.
const keyLiteralRe = /(['"])([A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+)\1/g
for (const filePath of walkSourceFiles(SRC_DIR)) {
  const fileContent = readFileSync(filePath, 'utf-8')
  const content = filePath.endsWith('.vue')
    ? Array.from(fileContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g), (match) => match[1]).join('\n')
    : fileContent
  let match
  while ((match = keyLiteralRe.exec(content)) !== null) recordReference(match[2])
}

for (const filePath of walkSourceFiles(SRC_DIR)) {
  const content = readFileSync(filePath, 'utf-8')
  let match
  while ((match = callRe.exec(content)) !== null) {
    const [, , namespace, key] = match
    recordReference(`${namespace}.${key}`)
    const keys = namespaceKeys.get(namespace)
    if (keys?.has(key)) continue
    if (!keys) continue // dynamic namespace — not a literal we can verify
    const line = content.slice(0, match.index).split('\n').length
    problems.push(`i18n key not found: ${relative(SRC_DIR, filePath)}:${line} ${namespace}.${key}`)
  }
}

// ── 3. Dead locale keys ─────────────────────────────────────────────

// Some keys are selected through constrained runtime suffixes instead of a
// literal t('namespace.key') call. Keep those contracts explicit here so a
// genuinely orphaned translation cannot hide behind broad pattern matching.
const dynamicKeyContracts = {
  preferences: new Set([
    'general',
    'downloads',
    'bt',
    'ed2k',
    'network',
    'advanced',
    'proxy-scope-download',
    'proxy-scope-bittorrent',
    'proxy-scope-update-app',
    'proxy-scope-update-trackers',
    'update-channel-stable',
    'update-channel-beta',
    'update-channel-latest',
    'color-scheme-amber',
    'color-scheme-space',
    'color-scheme-mint',
    'color-scheme-rose',
    'color-scheme-aurora',
    'color-scheme-coral',
    'color-scheme-glacier',
    'color-scheme-evergreen',
    'color-scheme-graphite',
    'color-scheme-sakura',
    'color-scheme-custom',
    'file-category-videos',
    'file-category-music',
    'file-category-images',
    'file-category-documents',
    'file-category-archives',
    'file-category-programs',
  ]),
  task: new Set([
    'scope-all',
    'scope-progress',
    'scope-failed',
    'scope-completed',
    'status-active',
    'status-waiting',
    'status-paused',
    'status-complete',
    'status-error',
    'status-removed',
    'status-sharing',
    'seeding',
    'sharing',
    'seeding-paused',
    'sharing-paused',
    'bt-metadata-fetching',
    'bt-recovering',
    'awaiting-file-selection',
    'pause-seeding',
    'pause-sharing',
    'resume-seeding',
    'resume-sharing',
    'finish-seeding',
    'finish-sharing',
    'finish-seeding-success',
    'finish-seeding-fail',
    'finish-sharing-success',
    'finish-sharing-fail',
    'file-priority-off',
    'file-priority-normal',
    'file-priority-high',
    'file-priority-top',
    'task-tracker-runtime-waiting',
    'task-tracker-runtime-updating',
    'task-tracker-runtime-working',
    'task-tracker-runtime-error',
    'task-bt-metadata-unknown',
    'task-bt-metadata-downloading',
    'task-bt-metadata-ready',
    'task-type-ed2k',
    'task-type-bt',
    'task-type-uri',
  ]),
}

for (const namespace of namespaces) {
  const defined = namespaceKeys.get(namespace) ?? new Set()
  const referenced = referencedKeys.get(namespace) ?? new Set()
  const dynamic = dynamicKeyContracts[namespace] ?? new Set()
  const missing = [...referenced, ...dynamic].filter((key) => !defined.has(key))
  const unused = [...defined].filter((key) => !referenced.has(key) && !dynamic.has(key))
  if (missing.length) problems.push(`missing i18n keys in ${namespace}.js: ${[...new Set(missing)].join(', ')}`)
  if (unused.length) problems.push(`unused i18n keys in ${namespace}.js: ${unused.join(', ')}`)
}

// ── Report ──────────────────────────────────────────────────────────

if (problems.length) {
  console.error(`✗ repo-integrity: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('✓ repo-integrity: i18n integrity OK')
