import { execFileSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = new URL('../src/assets/rayburst.svg', import.meta.url)
const icons = new URL('../src-tauri/icons/', import.meta.url)

// Tauri owns the platform formats and their complete resolution sets.
execFileSync(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'icon', fileURLToPath(source)], {
  cwd: root,
  stdio: 'inherit',
})

// This application only ships desktop targets.
await rm(new URL('ios/', icons), { recursive: true, force: true })
await rm(new URL('android/', icons), { recursive: true, force: true })

const svg = await readFile(source)
await sharp(svg, { density: 288 })
  .resize(64, 64)
  .png()
  .toFile(fileURLToPath(new URL('tray-icon-color.png', icons)))
const alpha = await sharp(svg, { density: 288 }).resize(88, 88).ensureAlpha().extractChannel('alpha').toBuffer()
await sharp({ create: { width: 88, height: 88, channels: 3, background: '#000000' } })
  .joinChannel(alpha)
  .png()
  .toFile(fileURLToPath(new URL('tray-icon@2x.png', icons)))
