/**
 * @fileoverview Extracted task CRUD operations from the Pinia task store.
 *
 * Contains: removeTask, pauseTask, resumeTask, pauseAllTask, resumeAllTask,
 * toggleTask, removeTaskRecord, purgeTaskRecord,
 * batchRemoveTask.
 *
 * Uses dependency injection — accepts API + store refs instead of importing
 * them directly, enabling testability and keeping the task store thin.
 */
import { TASK_STATUS } from '@shared/constants'
import { checkTaskIsBT, checkTaskIsSharing } from '@shared/utils'
import { logger } from '@shared/logger'
import { cleanupAria2ControlFiles, deleteTaskFiles } from '@/composables/useFileDelete'
import { cleanupAria2MetadataFiles } from '@/composables/useDownloadCleanup'
import { isAwaitingBtFileSelection } from '@/composables/useBtLifecycle'
import { useHistoryStore } from '@/stores/history'
import type { Aria2Task, TaskApi } from '@shared/types'
import type { Ref } from 'vue'

export interface MagnetSelectionCleanupTarget {
  gid: string
}

interface TaskOperationsDeps {
  api: TaskApi
  taskList: Ref<Aria2Task[]>
  currentTaskGid: Ref<string>
  hideTaskDetail: () => void
  fetchList: () => Promise<void>
  setTaskDeleting?: (gid: string, deleting: boolean) => void
  requestMagnetSelection?: (gid: string) => void
}

export function createTaskOperations(deps: TaskOperationsDeps) {
  const { api, taskList, currentTaskGid, hideTaskDetail, fetchList } = deps
  const setTaskDeleting = deps.setTaskDeleting ?? (() => undefined)

  async function requiresMagnetFileSelection(task: Aria2Task): Promise<boolean> {
    if (!isAwaitingBtFileSelection(task)) return false

    try {
      const options = await api.getOption({ gid: task.gid })
      return !options.selectFile?.trim()
    } catch (e) {
      logger.warn('TaskOps.resumeTask', `getOption gid=${task.gid} failed; keeping file selection pause: ${e}`)
      return true
    }
  }

  async function resumeTasks(tasks: Aria2Task[]): Promise<{ resumed: number; blocked: number }> {
    const checks = await Promise.all(
      tasks.map(async (task) => ({ task, blocked: await requiresMagnetFileSelection(task) })),
    )
    const resumableGids = checks.filter(({ blocked }) => !blocked).map(({ task }) => task.gid)
    const blocked = checks.length - resumableGids.length

    if (resumableGids.length > 0) {
      await api.batchResumeTask({ gids: resumableGids })
    }
    return { resumed: resumableGids.length, blocked }
  }

  async function removeTask(task: Aria2Task) {
    if (task.gid === currentTaskGid.value) hideTaskDetail()
    setTaskDeleting(task.gid, true)
    try {
      await api.deleteTask({ gid: task.gid, infoHash: task.infoHash })
      logger.info('TaskOps.removeTask', `gid=${task.gid}`)
      setTaskDeleting(task.gid, false)
      await fetchList()
      await api.saveSession()
    } catch (error) {
      setTaskDeleting(task.gid, false)
      await fetchList()
      throw error
    }
  }

  async function fetchTaskForCleanup(gid: string): Promise<Aria2Task | null> {
    try {
      return await api.fetchTaskItem({ gid })
    } catch (e) {
      logger.debug('TaskOps.cancelMagnetSelection', `fetchTaskItem gid=${gid} skipped: ${e}`)
      return null
    }
  }

  async function cleanupMagnetSelectionFiles(task: Aria2Task): Promise<void> {
    try {
      await cleanupAria2ControlFiles(task)
    } catch (e) {
      logger.debug('TaskOps.cancelMagnetSelection', `cleanupControlFile gid=${task.gid} skipped: ${e}`)
    }

    try {
      await deleteTaskFiles(task, 'trash')
    } catch (e) {
      logger.debug('TaskOps.cancelMagnetSelection', `deleteTaskFiles gid=${task.gid} skipped: ${e}`)
    }

    if (task.dir && task.infoHash) {
      try {
        await cleanupAria2MetadataFiles(task.dir, task.infoHash)
      } catch (e) {
        logger.debug('TaskOps.cancelMagnetSelection', `cleanupMetadata gid=${task.gid} skipped: ${e}`)
      }
    }
  }

  async function cancelMagnetSelectionDownload(target: MagnetSelectionCleanupTarget) {
    const { gid } = target
    if (gid === currentTaskGid.value) hideTaskDetail()

    try {
      const task = await fetchTaskForCleanup(gid)

      setTaskDeleting(gid, true)
      await api.deleteTask({ gid, infoHash: task?.infoHash })

      if (task) await cleanupMagnetSelectionFiles(task)

      logger.info('TaskOps.cancelMagnetSelection', `gid=${gid}`)
    } finally {
      setTaskDeleting(gid, false)
      await fetchList()
      await api.saveSession()
    }
  }

  async function pauseTask(task: Aria2Task) {
    const isBT = checkTaskIsBT(task)
    const promise = isBT ? api.forcePauseTask({ gid: task.gid }) : api.pauseTask({ gid: task.gid })
    try {
      await promise
      logger.info('TaskOps.pauseTask', `gid=${task.gid} bt=${isBT}`)
    } finally {
      await fetchList()
      await api.saveSession()
    }
  }

  async function resumeTask(task: Aria2Task): Promise<boolean> {
    if (await requiresMagnetFileSelection(task)) {
      logger.info('TaskOps.resumeTask', `gid=${task.gid} blocked=file-selection-required`)
      deps.requestMagnetSelection?.(task.gid)
      return false
    }

    try {
      await api.resumeTask({ gid: task.gid })
      logger.info('TaskOps.resumeTask', `gid=${task.gid}`)
      return true
    } finally {
      await fetchList()
      await api.saveSession()
    }
  }

  async function applyMagnetFileSelection(task: Aria2Task, selectFile: string): Promise<void> {
    if (task.status !== TASK_STATUS.PAUSED && task.status !== TASK_STATUS.WAITING) {
      throw new Error(`Cannot apply magnet file selection while task is ${task.status}`)
    }

    try {
      await api.changeOption({ gid: task.gid, options: { 'select-file': selectFile } })
      if (task.status === TASK_STATUS.PAUSED) {
        await api.resumeTask({ gid: task.gid })
      }
      logger.info('TaskOps.applyMagnetFileSelection', `gid=${task.gid} status=${task.status}`)
    } finally {
      await fetchList()
      await api.saveSession()
    }
  }

  async function pauseAllTask() {
    try {
      const pausableTasks = taskList.value.filter(
        (t) => t.status === TASK_STATUS.ACTIVE || t.status === TASK_STATUS.WAITING,
      )
      if (pausableTasks.length > 0) {
        await Promise.allSettled(pausableTasks.map((t) => api.forcePauseTask({ gid: t.gid })))
      }
      logger.info(
        'TaskOps.pauseAllTask',
        `paused=${pausableTasks.length} gids=[${pausableTasks.map((t) => t.gid).join(',')}]`,
      )
    } finally {
      await fetchList()
      await api.saveSession()
    }
  }

  async function resumeAllTask(): Promise<{ resumed: number; blocked: number }> {
    try {
      const pausedTasks = taskList.value.filter((task) => task.status === TASK_STATUS.PAUSED)
      const result = await resumeTasks(pausedTasks)
      logger.info('TaskOps.resumeAllTask', `resumed=${result.resumed} blocked=${result.blocked}`)
      return result
    } finally {
      await fetchList()
      await api.saveSession()
    }
  }

  function toggleTask(task: Aria2Task) {
    const { status } = task
    if (status === TASK_STATUS.ACTIVE) return pauseTask(task)
    if (status === TASK_STATUS.WAITING) return pauseTask(task)
    if (status === TASK_STATUS.PAUSED) return resumeTask(task)
    logger.debug('TaskOps.toggleTask', `no-op gid=${task.gid} status=${status} sharing=${checkTaskIsSharing(task)}`)
  }

  async function removeTaskRecord(task: Aria2Task) {
    await removeTask(task)
  }

  async function purgeTaskRecord() {
    const historyStore = useHistoryStore()
    await historyStore.clearRecords()
    try {
      await api.purgeTaskRecord()
    } catch (e) {
      logger.debug('TaskStore.purgeTaskRecord.aria2', e)
    }
    await fetchList()
    await api.saveSession()
  }

  async function batchRemoveTask(gids: string[]) {
    const tasks = new Map(taskList.value.map((task) => [task.gid, task]))
    gids.forEach((gid) => setTaskDeleting(gid, true))
    try {
      await Promise.all(gids.map((gid) => api.deleteTask({ gid, infoHash: tasks.get(gid)?.infoHash })))
      logger.info('TaskOps.batchRemoveTask', `removed ${gids.length} task(s) gids=[${gids.join(',')}]`)
    } finally {
      gids.forEach((gid) => setTaskDeleting(gid, false))
      await fetchList()
      await api.saveSession()
    }
  }

  async function hasActiveTasks(): Promise<boolean> {
    try {
      const tasks = await api.fetchTaskList({ type: TASK_STATUS.ACTIVE })
      return tasks.some((t) => t.status === TASK_STATUS.ACTIVE || t.status === TASK_STATUS.WAITING)
    } catch (e) {
      logger.debug('TaskOps.hasActiveTasks', `fetchTaskList failed: ${e}`)
      return false
    }
  }

  async function hasPausedTasks(): Promise<boolean> {
    try {
      const tasks = await api.fetchTaskList({ type: TASK_STATUS.ACTIVE })
      return tasks.some((t) => t.status === TASK_STATUS.PAUSED)
    } catch (e) {
      logger.debug('TaskOps.hasPausedTasks', `fetchTaskList failed: ${e}`)
      return false
    }
  }

  async function saveSession() {
    await api.saveSession()
  }

  return {
    removeTask,
    cancelMagnetSelectionDownload,
    pauseTask,
    resumeTask,
    applyMagnetFileSelection,
    resumeTasks,
    pauseAllTask,
    resumeAllTask,
    toggleTask,
    removeTaskRecord,
    purgeTaskRecord,
    batchRemoveTask,
    hasActiveTasks,
    hasPausedTasks,
    saveSession,
  }
}
