import { execFileSync } from 'node:child_process'
import { copyFileSync, readdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const output = mkdtempSync(join(tmpdir(), 'rayburst-icons-'))
const generate = (source, destination) => {
  execFileSync(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'icon', source, '--output', destination], {
    stdio: 'inherit',
  })
}
try {
  const source = readFileSync('public/logo.svg', 'utf8')
  const artwork = source.match(/^<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/)?.[1]
  if (!artwork || !source.includes('viewBox="0 0 512 512"')) {
    throw new Error('The logo master must have a 512 × 512 SVG viewBox')
  }
  generate('public/logo.svg', output)

  // Only the macOS application icon gets a plate. Keep the tray artwork transparent.
  const macosSource = join(output, 'macos.svg')
  writeFileSync(
    macosSource,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <rect x="48" y="48" width="416" height="416" rx="92" fill="#FFFFFF" />
  <g transform="translate(64 64) scale(0.75)">${artwork}</g>
</svg>`,
  )
  const macosOutput = join(output, 'macos')
  generate(macosSource, macosOutput)

  for (const entry of readdirSync(output, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== 'macos.svg' && entry.name !== 'icon.icns') {
      copyFileSync(join(output, entry.name), join('src-tauri/icons', entry.name))
    }
  }
  copyFileSync(join(macosOutput, 'icon.icns'), 'src-tauri/icons/icon.icns')
} finally {
  rmSync(output, { recursive: true, force: true })
}
