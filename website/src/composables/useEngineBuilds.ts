/**
 * @fileoverview Aria2 Next release builds: the one for the visitor's system,
 * every other build, and the checksums file. Links point at the latest
 * release page until the GitHub API answers.
 */
import { computed, onMounted, ref, shallowRef } from 'vue'
import { ENGINE_REPO, LINKS } from '@/links'
import type { IconName } from '@/ui/icons'
import { detectArch, latest, type Arch, type ReleaseAsset } from './github'

export interface EngineBuild {
  os: 'macOS' | 'Windows' | 'Linux' | 'Android'
  arch: Arch
  label: string
  icon: IconName
  match: RegExp
}

/** aria2-next release artifacts (README, Downloads). */
export const BUILDS: EngineBuild[] = [
  { os: 'macOS', arch: 'arm', label: 'Apple Silicon', icon: 'logo-apple', match: /-macos-arm64$/ },
  { os: 'macOS', arch: 'x86', label: 'Intel', icon: 'logo-apple', match: /-macos-x86_64$/ },
  { os: 'Windows', arch: 'x86', label: 'x86_64', icon: 'logo-windows', match: /-windows-x86_64\.exe$/ },
  { os: 'Windows', arch: 'arm', label: 'ARM64', icon: 'logo-windows', match: /-windows-arm64\.exe$/ },
  { os: 'Linux', arch: 'x86', label: 'x86_64', icon: 'logo-tux', match: /-linux-x86_64$/ },
  { os: 'Linux', arch: 'arm', label: 'ARM64', icon: 'logo-tux', match: /-linux-aarch64$/ },
  { os: 'Android', arch: 'arm', label: 'ARM64', icon: 'logo-android', match: /-android-arm64$/ },
]
const CHECKSUMS = /-checksums\.sha256$/

function engineOS(): EngineBuild['os'] | null {
  const ua = navigator.userAgent
  if (/Android/.test(ua)) return 'Android'
  if (/CrOS|iPhone|iPad/.test(ua)) return null
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return null
}

const os = engineOS()
const arch = ref<Arch>(os === 'macOS' || os === 'Android' ? 'arm' : 'x86')
const assets = shallowRef(new Map<EngineBuild, ReleaseAsset>())
const checksums = shallowRef<string | null>(null)
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  if (os === 'macOS' || os === 'Windows' || os === 'Linux') {
    detectArch().then((found) => {
      if (found) arch.value = found
    })
  }
  latest(ENGINE_REPO).then(
    (data) => {
      const found = new Map<EngineBuild, ReleaseAsset>()
      for (const b of BUILDS) {
        const asset = data.assets.find((a) => b.match.test(a.name))
        if (asset) found.set(b, asset)
      }
      assets.value = found
      checksums.value = data.assets.find((a) => CHECKSUMS.test(a.name))?.browser_download_url ?? null
    },
    () => {},
  )
}

export function useEngineBuilds() {
  onMounted(load)
  const chosen = computed(() =>
    os ? (BUILDS.find((b) => b.os === os && b.arch === arch.value) ?? BUILDS.find((b) => b.os === os)) : null,
  )
  const url = (b: EngineBuild | null | undefined) =>
    (b && assets.value.get(b)?.browser_download_url) || LINKS.engineLatest
  const size = (b: EngineBuild) => assets.value.get(b)?.size
  return { chosen, url, size, checksums }
}
