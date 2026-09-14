import type { Aria2Task } from '@shared/types'
import { getBtLifecycleState } from './useBtLifecycle'

function awaitingUserOrEngine(task: Aria2Task): boolean {
  return (
    ['selection', 'recovering', 'error'].includes(getBtLifecycleState(task)) ||
    task.media?.state === 'awaiting-selection' ||
    task.media?.state === 'finalizing'
  )
}

export function canPauseTask(task: Aria2Task): boolean {
  return ['active', 'waiting'].includes(task.status) && !awaitingUserOrEngine(task)
}

/** Batch resume must never resolve file or track selections implicitly. */
export function canResumeTask(task: Aria2Task): boolean {
  return task.status === 'paused' && !awaitingUserOrEngine(task)
}
