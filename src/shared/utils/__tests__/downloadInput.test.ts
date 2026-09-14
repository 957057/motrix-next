import { describe, expect, it } from 'vitest'
import { hasInvalidDownloadLinks } from '../downloadInput'

describe('download link validation', () => {
  it('rejects prose and malformed web addresses', () => {
    expect(hasInvalidDownloadLinks('not a link')).toBe(true)
    expect(hasInvalidDownloadLinks('https://')).toBe(true)
    expect(hasInvalidDownloadLinks('https://example.org/file\nnot a link')).toBe(true)
  })
  it('preserves input-file options and mirror URLs through the existing parser', () => {
    expect(hasInvalidDownloadLinks('https://example.org/file\thttps://mirror.example/file\n  out=file.zip')).toBe(false)
    expect(hasInvalidDownloadLinks('sftp://user@example.org/file')).toBe(false)
  })
  it('leaves non-web protocol grammar to the engine', () => {
    expect(hasInvalidDownloadLinks('ed2k://|file|test.zip|1024|0123456789abcdef0123456789abcdef|/')).toBe(false)
    expect(hasInvalidDownloadLinks('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567')).toBe(false)
    expect(hasInvalidDownloadLinks('thunder://QUFodHRwczovL2V4YW1wbGUuY29tL2EuemlwWlo=')).toBe(false)
  })
})
