/**
 * @fileoverview Rayburst desktop packages from the latest stable release: one
 * main package for the visitor's system and architecture, and every package
 * per platform. Links fall back to the releases page until GitHub answers.
 */
import { computed, onMounted, ref, shallowRef } from 'vue'
import { LINKS, REPO } from '@/links'
import type { IconName } from '@/ui/icons'
import { detectArch, detectOS, latest, type Arch, type DesktopOS, type ReleaseAsset } from './github'

type Kind = 'dmg' | 'exe' | 'appimage' | 'deb' | 'rpm'

interface Package {
  os: DesktopOS
  arch: Arch
  kind: Kind
  match: (name: string) => boolean
}

const PACKAGES: Package[] = [
  { os: 'macOS', arch: 'arm', kind: 'dmg', match: (n) => n.includes('aarch64') && n.endsWith('.dmg') },
  { os: 'macOS', arch: 'x86', kind: 'dmg', match: (n) => n.includes('x64') && n.endsWith('.dmg') },
  { os: 'Windows', arch: 'x86', kind: 'exe', match: (n) => n.includes('x64') && n.endsWith('-setup.exe') },
  { os: 'Windows', arch: 'arm', kind: 'exe', match: (n) => /(?:aarch64|arm64)/.test(n) && n.endsWith('-setup.exe') },
  { os: 'Linux', arch: 'x86', kind: 'appimage', match: (n) => n.includes('amd64') && n.endsWith('.AppImage') },
  { os: 'Linux', arch: 'x86', kind: 'deb', match: (n) => n.includes('amd64') && n.endsWith('.deb') },
  { os: 'Linux', arch: 'x86', kind: 'rpm', match: (n) => n.includes('x86_64') && n.endsWith('.rpm') },
  { os: 'Linux', arch: 'arm', kind: 'appimage', match: (n) => n.includes('aarch64') && n.endsWith('.AppImage') },
  { os: 'Linux', arch: 'arm', kind: 'deb', match: (n) => /(?:aarch64|arm64)/.test(n) && n.endsWith('.deb') },
  { os: 'Linux', arch: 'arm', kind: 'rpm', match: (n) => n.includes('aarch64') && n.endsWith('.rpm') },
]

export interface SystemInfo {
  icon: IconName
  arch: Partial<Record<Arch, string>>
  /** Package rows; the first is the main download. */
  rows: { kind: Kind; name: string; sub?: string }[]
  help: string
}

export const SYSTEMS: Record<DesktopOS, SystemInfo> = {
  macOS: {
    icon: 'logo-apple',
    arch: { arm: 'Apple Silicon', x86: 'Intel' },
    rows: [{ kind: 'dmg', name: '.dmg' }],
    help: 'dl.help.macOS',
  },
  Windows: {
    icon: 'logo-windows',
    arch: { x86: 'x64', arm: 'ARM64' },
    rows: [{ kind: 'exe', name: '.exe', sub: 'dl.installer' }],
    help: 'dl.help.windows',
  },
  Linux: {
    icon: 'logo-tux',
    arch: { x86: 'x64', arm: 'ARM64' },
    rows: [
      { kind: 'appimage', name: 'AppImage', sub: 'dl.appimage' },
      { kind: 'deb', name: '.deb', sub: 'dl.deb' },
      { kind: 'rpm', name: '.rpm', sub: 'dl.rpm' },
    ],
    help: 'dl.help.linux',
  },
}

export function useDesktopRelease() {
  const os = detectOS()
  const arch = ref<Arch>(os === 'macOS' ? 'arm' : 'x86')
  const assets = shallowRef(new Map<Package, ReleaseAsset>())
  const version = ref('')
  const notes = ref<string>(LINKS.latest)

  onMounted(() => {
    detectArch().then((found) => {
      if (found && os) arch.value = found
    })
    latest(REPO).then(
      (data) => {
        version.value = data.tag_name
        notes.value = data.html_url || LINKS.latest
        const found = new Map<Package, ReleaseAsset>()
        for (const p of PACKAGES) {
          const asset = data.assets.find((a) => p.match(a.name))
          if (asset) found.set(p, asset)
        }
        assets.value = found
      },
      () => {},
    )
  })

  const packagesFor = (system: DesktopOS, kind: Kind) =>
    PACKAGES.filter((p) => p.os === system && p.kind === kind).map((p) => ({ pkg: p, asset: assets.value.get(p) }))
  const main = computed(() => {
    if (!os) return null
    const kind = SYSTEMS[os].rows[0].kind
    const pkg = PACKAGES.find((p) => p.os === os && p.arch === arch.value && p.kind === kind)
    return pkg ? { pkg, asset: assets.value.get(pkg) } : null
  })

  return { os, arch, version, notes, main, packagesFor }
}
