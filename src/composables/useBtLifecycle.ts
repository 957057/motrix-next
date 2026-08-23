import type { Aria2Task } from '@shared/types'

export type BtLifecycleState =
  | 'none'
  | 'metadata'
  | 'selection'
  | 'checking'
  | 'downloading'
  | 'paused-download'
  | 'seeding'
  | 'paused-seeding'
  | 'terminal'

function isCompletePayload(task: Aria2Task): boolean {
  const total = Number(task.totalLength)
  return total > 0 && Number(task.completedLength) >= total
}

export function getBtLifecycleState(task: Aria2Task): BtLifecycleState {
  if (!task.bittorrent) return 'none'

  if (task.status === 'complete' || task.status === 'error' || task.status === 'removed') return 'terminal'

  switch (task.bittorrent.state) {
    case 'adding':
    case 'downloadingMetadata':
      return 'metadata'
    case 'awaitingFileSelection':
      return 'selection'
    case 'checking':
      return 'checking'
    case 'seeding':
      return task.status === 'paused' ? 'paused-seeding' : 'seeding'
  }

  if (task.status === 'paused') {
    return task.seeder === 'true' || isCompletePayload(task) ? 'paused-seeding' : 'paused-download'
  }
  if (task.status === 'active' && (task.seeder === 'true' || isCompletePayload(task))) return 'seeding'
  return 'downloading'
}

export function isAwaitingBtFileSelection(task: Aria2Task): boolean {
  return getBtLifecycleState(task) === 'selection'
}

export function isBtSeeding(task: Aria2Task): boolean {
  return getBtLifecycleState(task) === 'seeding'
}

export function isBtSeedingPaused(task: Aria2Task): boolean {
  return getBtLifecycleState(task) === 'paused-seeding'
}

export function formatBtDuration(
  seconds: number,
  units: { day: string; hour: string; minute: string; second: string },
): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  let remaining = Math.floor(seconds)
  const days = Math.floor(remaining / 86400)
  remaining %= 86400
  const hours = Math.floor(remaining / 3600)
  remaining %= 3600
  const minutes = Math.floor(remaining / 60)
  const secs = remaining % 60
  if (days > 0) return `${days}${units.day} ${hours}${units.hour}`
  if (hours > 0) return `${hours}${units.hour} ${minutes}${units.minute}`
  if (minutes > 0) return `${minutes}${units.minute} ${secs}${units.second}`
  return `${secs}${units.second}`
}
