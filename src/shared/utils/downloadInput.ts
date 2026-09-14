import { RESOURCE_TAGS } from '@shared/constants'
import { normalizeUriLines } from './batchHelpers'

/** Validate presentation input with the existing parser and the native URL parser. */
export function hasInvalidDownloadLinks(input: string): boolean {
  return normalizeUriLines(input).some((uri) => {
    const prefix = RESOURCE_TAGS.find((prefix) => uri.toLowerCase().startsWith(prefix))
    if (!prefix || uri.length <= prefix.length) return true
    // Non-web protocols have engine-owned grammars, including ED2K's pipe syntax.
    if (!['http://', 'https://', 'sftp://'].includes(prefix)) return false
    try {
      const url = new URL(uri)
      return !url.hostname
    } catch {
      return true
    }
  })
}
