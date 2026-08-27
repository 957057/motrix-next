import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  error: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  info: vi.fn().mockResolvedValue(undefined),
  debug: vi.fn().mockResolvedValue(undefined),
}))

import * as tauriLog from '@tauri-apps/plugin-log'
import { logger } from '@shared/logger'

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('sends structured fields through the native plugin', () => {
    logger.info('aria2.addTorrent', 'torrent_added', { gid: 'abc', count: 2 })
    expect(tauriLog.info).toHaveBeenCalledWith('torrent_added', {
      keyValues: { target: 'aria2.addTorrent', gid: 'abc', count: '2' },
    })
  })

  it('preserves error type and stack in one record', () => {
    const error = new TypeError('invalid task')
    logger.error('TaskStore', error, { gid: 'abc' })
    expect(tauriLog.error).toHaveBeenCalledTimes(1)
    expect(tauriLog.error).toHaveBeenCalledWith('invalid task', {
      keyValues: expect.objectContaining({
        target: 'TaskStore',
        gid: 'abc',
        error_type: 'TypeError',
        stack: expect.stringContaining('TypeError: invalid task'),
      }),
    })
  })

  it('serializes circular debug payloads without throwing', () => {
    const value: { self?: unknown } = {}
    value.self = value
    expect(() => logger.debug('Parser', value)).not.toThrow()
    expect(tauriLog.debug).toHaveBeenCalledWith(expect.stringContaining('[Circular]'), {
      keyValues: { target: 'Parser' },
    })
  })

  it('keeps plugin failures outside business logic', () => {
    vi.mocked(tauriLog.warn).mockRejectedValueOnce(new Error('IPC unavailable'))
    expect(() => logger.warn('Network', 'degraded')).not.toThrow()
  })
})
