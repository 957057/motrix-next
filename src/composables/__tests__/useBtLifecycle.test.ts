import { describe, expect, it } from 'vitest'
import { formatBtDuration, getBtLifecycleState, preserveBtSeedingPresentation } from '@/composables/useBtLifecycle'
import type { Aria2Task } from '@shared/types'

function task(overrides: Partial<Aria2Task>): Aria2Task {
  return {
    gid: 'gid',
    status: 'active',
    totalLength: '100',
    completedLength: '0',
    uploadLength: '0',
    downloadSpeed: '0',
    uploadSpeed: '0',
    connections: '0',
    dir: '/tmp',
    files: [],
    bittorrent: { state: 'downloading' },
    ...overrides,
  }
}

describe('getBtLifecycleState', () => {
  it('keeps file selection distinct from a generic pause', () => {
    expect(getBtLifecycleState(task({ status: 'paused', bittorrent: { state: 'awaitingFileSelection' } }))).toBe(
      'selection',
    )
  })

  it('distinguishes active and paused seeding', () => {
    expect(
      getBtLifecycleState(
        task({ status: 'active', completedLength: '100', seeder: 'true', bittorrent: { state: 'seeding' } }),
      ),
    ).toBe('seeding')
    expect(
      getBtLifecycleState(
        task({ status: 'paused', completedLength: '100', seeder: 'true', bittorrent: { state: 'paused' } }),
      ),
    ).toBe('paused-seeding')
  })

  it('keeps incomplete pauses resumable as downloads', () => {
    expect(getBtLifecycleState(task({ status: 'paused', bittorrent: { state: 'paused' } }))).toBe('paused-download')
  })

  it('formats multi-day seeding time without truncating it', () => {
    expect(formatBtDuration(183900, { day: 'd', hour: 'h', minute: 'm', second: 's' })).toBe('2d 3h')
  })

  it('preserves completed seeding presentation across transient restore payloads', () => {
    const previous = task({
      status: 'paused',
      totalLength: '1024',
      completedLength: '1024',
      seeder: 'true',
      bittorrent: { state: 'paused' },
    })
    const restoring = task({
      status: 'active',
      totalLength: '1024',
      completedLength: '0',
      seeder: 'false',
      bittorrent: { state: 'checking', progress: '0.000000' },
    })

    const [presented] = preserveBtSeedingPresentation([previous], [restoring])

    expect(presented.completedLength).toBe('1024')
    expect(presented.seeder).toBe('true')
    expect(presented.bittorrent?.state).toBe('checking')
    expect(getBtLifecycleState(presented)).toBe('restoring-seeding')
  })

  it('does not mask restore payloads for incomplete downloads', () => {
    const previous = task({ status: 'paused', completedLength: '50', bittorrent: { state: 'paused' } })
    const checking = task({ status: 'active', completedLength: '0', bittorrent: { state: 'checking' } })

    expect(preserveBtSeedingPresentation([previous], [checking])[0]).toBe(checking)
  })
})
