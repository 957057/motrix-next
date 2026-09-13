/** @fileoverview Tests for Rayburst internal deep-link parsing. */
import { describe, expect, it } from 'vitest'
import { isRayburstNewTaskLink, parseRayburstDeepLink } from '../rayburstDeepLink'

describe('rayburstDeepLink', () => {
  it('parses the canonical extension new-task deep link', () => {
    const link =
      'rayburst://new?url=https%3A%2F%2Fexample.com%2Ffile.zip&referer=https%3A%2F%2Fexample.com&cookie=session%3Dabc&filename=file.zip'

    const parsed = parseRayburstDeepLink(link)

    expect(parsed.valid).toBe(true)
    expect(parsed.action).toBe('new')
    expect(parsed.isNewTask).toBe(true)
    expect(parsed.downloadUrl).toBe('https://example.com/file.zip')
    expect(parsed.referer).toBe('https://example.com')
    expect(parsed.cookie).toBe('session=abc')
    expect(parsed.filename).toBe('file.zip')
  })

  it('parses single-slash new-task deep links through the same path', () => {
    const link = 'rayburst:/new?url=https%3A%2F%2Fexample.com%2Ffile.zip'

    const parsed = parseRayburstDeepLink(link)

    expect(parsed.valid).toBe(true)
    expect(parsed.action).toBe('new')
    expect(parsed.isNewTask).toBe(true)
    expect(parsed.downloadUrl).toBe('https://example.com/file.zip')
    expect(isRayburstNewTaskLink(link)).toBe(true)
  })

  it('treats rayburst wake links without a download URL as wake-only', () => {
    const parsed = parseRayburstDeepLink('rayburst://')

    expect(parsed.valid).toBe(true)
    expect(parsed.action).toBe('none')
    expect(parsed.isNewTask).toBe(false)
    expect(parsed.downloadUrl).toBe('')
  })

  it('rejects non-Rayburst URLs', () => {
    const parsed = parseRayburstDeepLink('https://example.com/file.zip')

    expect(parsed.valid).toBe(false)
    expect(parsed.reason).toBe('unsupported-scheme')
    expect(isRayburstNewTaskLink('https://example.com/file.zip')).toBe(false)
  })
})
