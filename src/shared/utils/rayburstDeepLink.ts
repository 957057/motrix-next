/** @fileoverview Parser for Rayburst internal deep-link inputs. */

export type RayburstDeepLinkAction = 'new' | 'none' | 'unknown'
export type RayburstDeepLinkFailureReason = 'unsupported-scheme' | 'malformed'

export interface ParsedRayburstDeepLink {
  valid: boolean
  action: RayburstDeepLinkAction
  isNewTask: boolean
  downloadUrl: string
  referer: string
  cookie: string
  filename: string
  reason?: RayburstDeepLinkFailureReason
}

const EMPTY_RESULT: ParsedRayburstDeepLink = {
  valid: false,
  action: 'none',
  isNewTask: false,
  downloadUrl: '',
  referer: '',
  cookie: '',
  filename: '',
}

function hasRayburstScheme(value: string): boolean {
  return value.trim().toLowerCase().startsWith('rayburst:')
}

function normalizeAction(value: string): RayburstDeepLinkAction {
  if (!value) return 'none'
  return value.toLowerCase() === 'new' ? 'new' : 'unknown'
}

function getFirstPathSegment(pathname: string): string {
  return pathname.replace(/^\/+/, '').split(/[/?#]/, 1)[0] || ''
}

/** Parse Rayburst links through the native URL implementation. */
export function parseRayburstDeepLink(value: string): ParsedRayburstDeepLink {
  if (!hasRayburstScheme(value)) {
    return { ...EMPTY_RESULT, reason: 'unsupported-scheme' }
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ...EMPTY_RESULT, valid: false, reason: 'malformed' }
  }

  if (parsed.protocol.toLowerCase() !== 'rayburst:') {
    return { ...EMPTY_RESULT, reason: 'unsupported-scheme' }
  }

  const action = normalizeAction(parsed.hostname || getFirstPathSegment(parsed.pathname))
  const params = parsed.searchParams
  const downloadUrl = params.get('url') || ''

  return {
    valid: true,
    action,
    isNewTask: action === 'new' && downloadUrl.length > 0,
    downloadUrl,
    referer: params.get('referer') || '',
    cookie: params.get('cookie') || '',
    filename: params.get('filename') || '',
  }
}

export function isRayburstNewTaskLink(value: string): boolean {
  return parseRayburstDeepLink(value).isNewTask
}
