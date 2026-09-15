/** @fileoverview Coarse file kind classification used for list iconography. */

export type FileKind =
  | 'video'
  | 'audio'
  | 'image'
  | 'archive'
  | 'document'
  | 'software'
  | 'torrent'
  | 'stream'
  | 'folder'
  | 'file'

const KIND_EXTENSIONS: Record<Exclude<FileKind, 'stream' | 'folder' | 'file'>, readonly string[]> = {
  video: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'ts', 'mpg', 'mpeg', 'rmvb', '3gp'],
  audio: ['mp3', 'flac', 'aac', 'm4a', 'wav', 'ogg', 'opus', 'wma', 'ape', 'aiff'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'svg', 'bmp', 'tif', 'tiff', 'psd', 'raw'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz', 'iso', 'dmg', 'img', 'cab'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'epub', 'mobi', 'rtf', 'csv', 'odt'],
  software: ['exe', 'msi', 'apk', 'deb', 'rpm', 'appimage', 'pkg', 'jar', 'bin', 'run', 'flatpak', 'snap'],
  torrent: ['torrent'],
}

const EXTENSION_TO_KIND: ReadonlyMap<string, FileKind> = new Map(
  (Object.entries(KIND_EXTENSIONS) as [FileKind, readonly string[]][]).flatMap(([kind, extensions]) =>
    extensions.map((extension) => [extension, kind] as const),
  ),
)

export function fileKindFromName(name: string): FileKind {
  const trimmed = name.trim().replace(/[?#].*$/, '')
  const dot = trimmed.lastIndexOf('.')
  if (dot <= 0 || dot === trimmed.length - 1) return 'file'
  return EXTENSION_TO_KIND.get(trimmed.slice(dot + 1).toLowerCase()) ?? 'file'
}
