/**
 * @fileoverview Formatting that matches Rayburst (src/shared/utils/format.ts, media.ts).
 */
import type { Translate } from '@/i18n'

const SIZES = ['B', 'KB', 'MB', 'GB', 'TB']
export const MB = 1024 * 1024

/** bytesToSize(bytes, precision) */
export function bytes(n: number, precision = 1) {
  const b = Math.max(0, Math.floor(n))
  if (b === 0) return '0 KB'
  const i = Math.min(SIZES.length - 1, Math.floor(Math.log(b) / Math.log(1024)))
  if (i === 0) return `${b} ${SIZES[i]}`
  return `${(b / 1024 ** i).toFixed(precision)} ${SIZES[i]}`
}

/** timeFormat(seconds, { prefix }) with the app's h / m / s units. */
export function remaining(t: Translate, seconds: number) {
  let secs = Math.floor(seconds)
  if (!(secs > 0) || !Number.isFinite(secs)) return ''
  let out = ''
  if (secs > 3600) {
    out += `${Math.floor(secs / 3600)}${t('ui.h')} `
    secs %= 3600
  }
  if (secs > 60) {
    out += `${Math.floor(secs / 60)}${t('ui.m')} `
    secs %= 60
  }
  return `${t('ui.remaining')} ${out}${secs}${t('ui.s')}`
}

/** mediaDuration: always HH:MM:SS. */
export function clock(seconds: number) {
  const v = Math.max(0, Math.floor(seconds))
  return [Math.floor(v / 3600), Math.floor(v / 60) % 60, v % 60].map((p) => String(p).padStart(2, '0')).join(':')
}

/** The tray title's compact speed (src-tauri/src/services/stat.rs, tray_title_for_speed). */
export function compactSpeed(bps: number) {
  const b = Math.max(0, Math.floor(bps))
  if (b >= 1024 ** 3) return `↓${(b / 1024 ** 3).toFixed(1)}G`
  if (b >= MB) return `↓${(b / MB).toFixed(1)}M`
  if (b >= 1024) return `↓${Math.round(b / 1024)}K`
  return `↓${b}B`
}

export const pct = (p: number) => Math.floor(Math.min(1, Math.max(0, p)) * 100)

/** Release asset size for the download buttons. */
export function fileSize(size?: number) {
  if (!size) return ''
  const mb = size / MB
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}

/** Stars and download counts: 1234 → 1.2k. */
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))
