#!/usr/bin/env node
/**
 * Download the open-licensed (SIL OFL) fonts the film uses into assets/fonts.
 * Inter and JetBrains Mono ship with the project; Noto Sans covers Chinese and the
 * 27-language cut.
 *   node scripts/fetch-fonts.mjs [--force]
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './serve.mjs'

const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl'
const FONTS = [
  ['InterVariable.woff2', 'https://rsms.me/inter/font-files/InterVariable.woff2'],
  ['JetBrainsMono-VF.ttf', `${GF}/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf`],
  ['NotoSansSC-VF.ttf', `${GF}/notosanssc/NotoSansSC%5Bwght%5D.ttf`],
  ['NotoSansJP-VF.ttf', `${GF}/notosansjp/NotoSansJP%5Bwght%5D.ttf`],
  ['NotoSansKR-VF.ttf', `${GF}/notosanskr/NotoSansKR%5Bwght%5D.ttf`],
  ['NotoSansArabic-VF.ttf', `${GF}/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf`],
  ['NotoSansDevanagari-VF.ttf', `${GF}/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`],
  ['NotoSansThai-VF.ttf', `${GF}/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf`],
]

const dir = join(ROOT, 'assets', 'fonts')
mkdirSync(dir, { recursive: true })
const force = process.argv.includes('--force')
let failed = 0
for (const [name, url] of FONTS) {
  const file = join(dir, name)
  if (!force && existsSync(file) && statSync(file).size > 10_000) {
    console.log(`✓ ${name} (present)`)
    continue
  }
  process.stdout.write(`↓ ${name} … `)
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(file, buf)
    console.log(`${(buf.length / 1048576).toFixed(1)} MB`)
  } catch (err) {
    failed++
    console.log(`failed (${err.message})`)
  }
}
if (failed) {
  console.log(
    `\n${failed} font(s) failed. The film still renders with system fallbacks; re-run this command to retry, or download the listed URLs into assets/fonts by hand.`,
  )
  process.exitCode = 1
}
