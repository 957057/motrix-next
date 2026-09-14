/** @fileoverview Pinia store for download task management: list, add, pause, resume, remove. */
import { defineStore } from 'pinia'
import { useTaskViewStore } from '@/stores/taskView'
import { useTaskSelectionStore } from '@/stores/taskSelection'
import { reactive, ref, watch } from 'vue'
import { EMPTY_STRING } from '@shared/constants'
import { logger } from '@shared/logger'
import type { Aria2Task, Aria2File, Aria2Peer, Aria2EngineOptions, AddUriParams, TaskApi } from '@shared/types'

import { mergeHistoryIntoTasks } from '@/composables/useTaskLifecycle'
import { buildMagnetOptions } from '@/composables/useMagnetFlow'
import { registerAddedAt, getAddedAt, loadAddedAtFromRecords } from '@/composables/useTaskOrder'
import {
  createManualOrderSnapshot,
  type ProgressSortField,
  type AllSortField,
  type SortDirection,
  type TaskScope,
  type TerminalSortField,
} from '@/composables/useTaskSort'
import { DEFAULT_TASK_SORT } from '@/composables/useTaskSort'
import { useHistoryStore } from '@/stores/history'
import { usePreferenceStore } from '@/stores/preference'

import { resubmitTask, type TaskResubmissionMode } from './resubmit'
import { createTaskOperations } from './operations'

export type { Aria2Task, Aria2File, Aria2Peer }

const DEFAULT_TASK_PAGE_SIZE = 20
const TASK_SCOPES: readonly TaskScope[] = ['all', 'progress', 'failed', 'completed']

function normalizeTaskScope(list: string): TaskScope {
  return TASK_SCOPES.includes(list as TaskScope) ? (list as TaskScope) : 'all'
}

export interface TaskCounts {
  all: number
  progress: number
  failed: number
  completed: number
}

export const useTaskStore = defineStore('task', () => {
  const preferenceStore = usePreferenceStore()
  const currentList = ref<TaskScope>('all')
  const taskDetailVisible = ref(false)
  const taskDetailClosing = ref(false)
  const currentTaskGid = ref(EMPTY_STRING)
  const enabledFetchPeers = ref(false)
  const currentTaskItem = ref<Aria2Task | null>(null)
  const currentTaskFiles = ref<Aria2File[]>([])
  const currentTaskPeers = ref<Aria2Peer[]>([])
  const taskList = ref<Aria2Task[]>([])
  const queryError = ref('')
  const pendingGids = ref<string[]>([])
  const operationPromises = new Map<string, Promise<unknown>>()
  const removingGids = ref<string[]>([])
  const resubmittingGids = ref<string[]>([])
  const taskCounts = reactive<TaskCounts>({ all: 0, progress: 0, failed: 0, completed: 0 })
  const taskPagination = reactive({
    all: { page: 1, total: 0, loaded: false },
    progress: { page: 1, total: 0, loaded: false },
    failed: { page: 1, total: 0, loaded: false },
    completed: { page: 1, total: 0, loaded: false },
    pageSize: clampPageSize(preferenceStore.config.taskPageSize),
  })
  const visibleTaskPageCount = ref(1)

  let api: TaskApi
  let apiReady = false
  let listRequestId = 0
  const resubmissionPromises = new Map<string, Promise<void>>()
  /** In-memory map: GID → original .torrent file path for post-download cleanup. */
  const torrentSourcePaths = new Map<string, string>()
  const registerTorrentSource = (gid: string, path: string) => torrentSourcePaths.set(gid, path)
  function consumeTorrentSource(gid: string): string | undefined {
    const p = torrentSourcePaths.get(gid)
    if (p) torrentSourcePaths.delete(gid)
    return p
  }

  function setApi(a: TaskApi) {
    api = a
    apiReady = true
    // Wire up task operations once API is available
    const ops = createTaskOperations({
      api,
      taskList,
      currentTaskGid,
      hideTaskDetail,
      fetchList,
      setTaskRemoving,
      requestMediaSelection: (task) => useTaskSelectionStore().request({ kind: 'media', gid: task.gid }),
      requestMagnetSelection: (gid) => useTaskSelectionStore().request({ kind: 'bt', gid }),
      clearSelections: (gids) => useTaskSelectionStore().forget(gids),
    })
    Object.assign(taskOps, ops)
  }

  async function changeCurrentList(list: string) {
    const scope = normalizeTaskScope(list)
    const sameList = currentList.value === scope
    currentList.value = scope
    if (!sameList) {
      const tab = currentTaskTab()
      if (taskPagination[tab].loaded) refreshCurrentTaskPageCount()
    }
    await fetchList()
  }

  function currentTaskTab(): TaskScope {
    return currentList.value
  }

  function clampPage(page: number): number {
    return Math.max(1, Math.floor(Number.isFinite(page) ? page : 1))
  }

  function clampPageSize(size: number): number {
    return Math.min(Math.max(1, Math.floor(Number.isFinite(size) ? size : DEFAULT_TASK_PAGE_SIZE)), 100)
  }

  function maxTaskPage(tab = currentTaskTab()): number {
    return Math.max(1, Math.ceil(taskPagination[tab].total / taskPagination.pageSize))
  }

  function currentTaskPageCount(): number {
    return visibleTaskPageCount.value
  }

  function refreshCurrentTaskPageCount(tab = currentTaskTab()) {
    visibleTaskPageCount.value = maxTaskPage(tab)
  }

  function clampCurrentTaskPage() {
    const tab = currentTaskTab()
    taskPagination[tab].page = Math.min(clampPage(taskPagination[tab].page), maxTaskPage(tab))
  }

  function updateCurrentTaskTotal(total: number) {
    const tab = currentTaskTab()
    taskPagination[tab].total = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0))
    taskPagination[tab].loaded = true
  }

  function setTaskPage(tab: TaskScope, page: number) {
    taskPagination[tab].page = clampPage(page)
  }

  function setCurrentTaskPage(page: number) {
    setTaskPage(currentTaskTab(), page)
    void fetchList()
  }

  function applyTaskPageSize(size: number) {
    const pageSize = clampPageSize(size)
    if (taskPagination.pageSize === pageSize) return pageSize
    taskPagination.pageSize = pageSize
    clampCurrentTaskPage()
    refreshCurrentTaskPageCount()
    return pageSize
  }

  function setTaskPageSize(size: number) {
    const pageSize = applyTaskPageSize(size)
    void fetchList()
    preferenceStore
      .updateAndSave({ taskPageSize: pageSize })
      .catch((e: unknown) => logger.error('TaskStore.setTaskPageSize', e))
  }

  watch(
    () => preferenceStore.config.taskPageSize,
    (size) => {
      applyTaskPageSize(size)
    },
  )

  async function fetchList() {
    if (!apiReady) return
    const requestId = ++listRequestId
    const scope = currentTaskTab()
    const view = useTaskViewStore()
    const query = view.query.trim()
    try {
      const sort = preferenceStore.config.taskSort[scope] ?? DEFAULT_TASK_SORT[scope]
      const result = await api.queryTasks({
        scope,
        query,
        page: taskPagination[scope].page,
        pageSize: taskPagination.pageSize,
        sortField: sort.field,
        direction: sort.direction,
        manualOrder: preferenceStore.config.taskManualOrder[scope],
      })
      if (requestId !== listRequestId || currentTaskTab() !== scope || query !== view.query.trim()) return
      const selection = useTaskSelectionStore()
      selection.reconcile(
        result.selections.filter((item) => item.waiting),
        result.selections,
      )
      const merged = mergeHistoryIntoTasks(result.tasks, result.history)
      const byGid = new Map(merged.map((task) => [task.gid, task]))
      taskList.value = result.gids.map((gid) => byGid.get(gid)).filter((task): task is Aria2Task => !!task)
      Object.assign(taskCounts, result.counts)
      loadAddedAtFromRecords(result.history)
      updateCurrentTaskTotal(result.total)
      taskPagination[scope].page = result.page
      refreshCurrentTaskPageCount()
      queryError.value = ''
      if (taskDetailVisible.value && currentTaskGid.value) {
        const gid = currentTaskGid.value
        try {
          const fresh = enabledFetchPeers.value
            ? await api.fetchTaskItemWithPeers({ gid })
            : await api.fetchTaskItem({ gid })
          if (gid === currentTaskGid.value && taskDetailVisible.value) updateCurrentTaskItem(fresh)
        } catch (error) {
          logger.debug('TaskStore.detail', error)
          const fresh = byGid.get(gid)
          if (fresh && gid === currentTaskGid.value) updateCurrentTaskItem(fresh)
        }
      }
    } catch (error) {
      if (requestId !== listRequestId) return
      queryError.value = error instanceof Error ? error.message : String(error)
      logger.warn('TaskStore.query', queryError.value)
    }
  }

  function setTaskRemoving(gid: string, removing: boolean) {
    removingGids.value = removing
      ? [...new Set([...removingGids.value, gid])]
      : removingGids.value.filter((id) => id !== gid)
  }

  function runTaskOperation<T>(task: Aria2Task, operation: () => Promise<T>): Promise<T> {
    const existing = operationPromises.get(task.gid)
    if (existing) return existing as Promise<T>
    pendingGids.value = [...pendingGids.value, task.gid]
    const promise = operation().finally(() => {
      operationPromises.delete(task.gid)
      pendingGids.value = pendingGids.value.filter((gid) => gid !== task.gid)
    })
    operationPromises.set(task.gid, promise)
    return promise
  }

  async function saveManualOrder(gids: string[]) {
    const preferenceStore = usePreferenceStore()
    const tab = currentTaskTab()
    const taskSort = {
      ...preferenceStore.config.taskSort,
      [tab]: {
        ...preferenceStore.config.taskSort[tab],
        field: 'manual',
      },
    }
    const taskManualOrder = {
      ...preferenceStore.config.taskManualOrder,
      [tab]: [...gids],
    }
    await preferenceStore.updateAndSave({ taskSort, taskManualOrder })
  }

  async function saveCurrentManualOrder() {
    await saveManualOrder(createManualOrderSnapshot(taskList.value))
  }

  async function saveVisiblePageManualOrder(visibleTasks: Aria2Task[]) {
    const next = visibleTasks.map((task) => task.gid)
    const previous = preferenceStore.config.taskManualOrder[currentTaskTab()]
    const selected = new Set(next)
    let index = 0
    const order = previous.map((gid) => (selected.has(gid) ? next[index++] : gid))
    order.push(...next.slice(index))
    await saveManualOrder(order)
    await fetchList()
  }

  async function changeCurrentSort(field: ProgressSortField | TerminalSortField | AllSortField) {
    const preferenceStore = usePreferenceStore()
    const tab = currentTaskTab()
    const taskSort = preferenceStore.config?.taskSort ?? DEFAULT_TASK_SORT
    const current = taskSort[tab]
    const direction: SortDirection =
      field === 'manual' ? 'desc' : current.field === field ? (current.direction === 'desc' ? 'asc' : 'desc') : 'desc'
    const nextTaskSort = { ...taskSort, [tab]: { field, direction } }
    const nextConfig =
      field === 'manual'
        ? {
            taskSort: nextTaskSort,
            taskManualOrder: {
              ...preferenceStore.config.taskManualOrder,
              [tab]: createManualOrderSnapshot(taskList.value),
            },
          }
        : { taskSort: nextTaskSort }

    preferenceStore.updatePreference(nextConfig)
    await fetchList()
    preferenceStore.updateAndSave(nextConfig).catch((e: unknown) => logger.error('TaskStore.changeCurrentSort', e))
  }

  async function fetchItem(gid: string) {
    const data = await api.fetchTaskItem({ gid })
    updateCurrentTaskItem(data)
  }

  function showTaskDetail(task: Aria2Task) {
    enabledFetchPeers.value = false
    updateCurrentTaskItem(task)
    currentTaskGid.value = task.gid
    taskDetailVisible.value = true
  }

  async function showTaskDetailByGid(gid: string) {
    const task = await api.fetchTaskItem({ gid })
    showTaskDetail(task)
  }

  function hideTaskDetail() {
    enabledFetchPeers.value = false
    if (taskDetailVisible.value) taskDetailClosing.value = true
    taskDetailVisible.value = false
  }

  function updateCurrentTaskItem(task: Aria2Task | null) {
    currentTaskItem.value = task
    if (task) {
      currentTaskFiles.value = task.files
      currentTaskPeers.value = task.peers || []
    } else {
      currentTaskFiles.value = []
      currentTaskPeers.value = []
    }
  }

  async function addUri(data: AddUriParams) {
    const gids = await api.addUri(data)
    gids.forEach((gid) => useTaskSelectionStore().register(gid, true))

    const now = new Date().toISOString()
    const historyStore = useHistoryStore()
    for (const gid of gids) {
      registerAddedAt(gid, now)
      historyStore.recordTaskBirth(gid, now).catch((e) => logger.debug('taskBirth.write', e))
    }
    await fetchList()
  }

  async function addUriAtomic(data: { uris: string[]; options: Aria2EngineOptions }) {
    const gid = await api.addUriAtomic(data)
    useTaskSelectionStore().register(gid, true)
    const now = new Date().toISOString()
    registerAddedAt(gid, now)
    const historyStore = useHistoryStore()
    historyStore.recordTaskBirth(gid, now).catch((e) => logger.debug('taskBirth.write', e))
    await fetchList()
    return gid
  }

  /**
   * Adds a magnet URI as a normal download. The returned GID owns the complete
   * metadata, file-selection, download, and seeding lifecycle.
   *
   * aria2 either continues with every file or pauses for selection according
   * to the application-owned magnet selection policy.
   */
  async function addMagnetUri(data: {
    uri: string
    requestId?: string
    options: Aria2EngineOptions
    fileCategory?: { enabled: boolean; categories: import('@shared/types').FileCategory[] }
  }): Promise<string> {
    const policy = preferenceStore.config.magnetFileSelectionPolicy
    const classifyFiles = Boolean(data.fileCategory?.enabled && data.fileCategory.categories.length > 0)
    const options = {
      ...buildMagnetOptions(data.options, policy, classifyFiles),
      'check-integrity': 'true',
      'force-save': 'true',
    }

    const gids = await api.addUri({
      uris: [data.uri],
      outs: [],
      options,
      ...(data.requestId ? { contexts: { [data.uri]: { requestId: data.requestId } } } : {}),
    })
    const gid = gids[0]

    // Register birth timestamp
    const now = new Date().toISOString()
    registerAddedAt(gid, now)
    const historyStore = useHistoryStore()
    historyStore.recordTaskBirth(gid, now).catch((e) => logger.debug('taskBirth.write', e))

    if (policy !== 'download-all' || classifyFiles) {
      useTaskSelectionStore().register(gid, policy === 'prompt')
    }

    await fetchList()
    return gid
  }

  /** Fetch a single task's full status. */
  async function fetchTaskStatus(gid: string): Promise<Aria2Task> {
    return api.fetchTaskItem({ gid })
  }

  /** Retrieves the file list for a download task. */
  async function getFiles(gid: string): Promise<Aria2File[]> {
    return api.getFiles({ gid })
  }

  async function addTorrent(data: { torrent: string; options: Aria2EngineOptions; requestId?: string }) {
    const gid = await api.addTorrent(data)
    const now = new Date().toISOString()
    registerAddedAt(gid, now)
    const historyStore = useHistoryStore()
    historyStore.recordTaskBirth(gid, now).catch((e) => logger.debug('taskBirth.write', e))
    await fetchList()
    return gid
  }

  async function getTaskOption(gid: string) {
    return api.getOption({ gid })
  }

  async function changeTaskOption(payload: { gid: string; options: Aria2EngineOptions }) {
    return api.changeOption(payload)
  }

  // Task CRUD operations are delegated to the taskOperations module.
  // The ops object is populated when setApi() is called.
  const taskOps = {} as ReturnType<typeof createTaskOperations>

  function resubmitTerminalTask(task: Aria2Task, mode: TaskResubmissionMode): Promise<void> {
    const existing = resubmissionPromises.get(task.gid)
    if (existing) return existing

    const historyStore = useHistoryStore()
    const policy = preferenceStore.config.magnetFileSelectionPolicy
    resubmittingGids.value = [...resubmittingGids.value, task.gid]
    listRequestId += 1
    const operation = (
      task.media && mode === 'retry'
        ? api.retryMedia(task.gid).then((gid) => [gid])
        : resubmitTask(task, mode, api, historyStore, policy, async (gid) => {
            useTaskSelectionStore().register(gid, policy === 'prompt')
          })
    )
      .then(async (gids) => {
        if (task.media) gids.forEach((gid) => useTaskSelectionStore().register(gid, true))
        const replacement = gids[0]
        if (!replacement) return
        const addedAt = getAddedAt(task.gid) ?? new Date().toISOString()
        registerAddedAt(replacement, addedAt)
        historyStore.recordTaskBirth(replacement, addedAt).catch((error) => logger.warn('taskBirth.replace', error))
        const order = preferenceStore.config.taskManualOrder
        if (!TASK_SCOPES.some((scope) => order[scope].includes(task.gid))) return
        await preferenceStore
          .updateAndSave({
            taskManualOrder: {
              all: order.all.map((gid) => (gid === task.gid ? replacement : gid)),
              progress: order.progress.map((gid) => (gid === task.gid ? replacement : gid)),
              failed: order.failed.map((gid) => (gid === task.gid ? replacement : gid)),
              completed: order.completed.map((gid) => (gid === task.gid ? replacement : gid)),
            },
          })
          .catch((error) => logger.warn('TaskStore.replaceManualOrder', error))
      })
      .then(async () => {
        await api.saveSession()
      })
      .finally(async () => {
        resubmissionPromises.delete(task.gid)
        resubmittingGids.value = resubmittingGids.value.filter((gid) => gid !== task.gid)
        await fetchList()
      })
    resubmissionPromises.set(task.gid, operation)
    return operation
  }

  return {
    queryError,
    pendingGids,
    currentList,
    taskCounts,
    taskDetailVisible,
    taskDetailClosing,
    currentTaskGid,
    enabledFetchPeers,
    currentTaskItem,
    currentTaskFiles,
    currentTaskPeers,
    taskList,
    removingGids,
    resubmittingGids,
    taskPagination,
    currentTaskPageCount,
    setApi,
    changeCurrentList,
    fetchList,
    saveManualOrder,
    saveCurrentManualOrder,
    saveVisiblePageManualOrder,
    setTaskPage,
    setCurrentTaskPage,
    setTaskPageSize,
    clampCurrentTaskPage,
    changeCurrentSort,
    fetchItem,
    showTaskDetail,
    showTaskDetailByGid,
    hideTaskDetail,
    updateCurrentTaskItem,
    addUri,
    addUriAtomic,
    addTorrent,
    addMagnetUri,
    getFiles,
    fetchTaskStatus,
    getTaskOption,
    changeTaskOption,
    removeTask: (task: Aria2Task) => runTaskOperation(task, () => taskOps.removeTask(task)),
    pauseTask: (task: Aria2Task) => runTaskOperation(task, () => taskOps.pauseTask(task)),
    finishSharing: (task: Aria2Task) => runTaskOperation(task, () => taskOps.finishSharing(task)),
    finishSharingTasks: (gids: string[]) => taskOps.finishSharingTasks(gids),
    resumeTask: (task: Aria2Task) => runTaskOperation(task, () => taskOps.resumeTask(task)),
    applyMagnetFileSelection: (task: Aria2Task, selectFile: string, targetDir?: string) =>
      taskOps.applyMagnetFileSelection(task, selectFile, targetDir),
    pauseAllTask: () => taskOps.pauseAllTask(),
    resumeAllTask: () => taskOps.resumeAllTask(),
    toggleTask: (task: Aria2Task) => taskOps.toggleTask(task),
    removeTaskRecord: (task: Aria2Task) => runTaskOperation(task, () => taskOps.removeTaskRecord(task)),
    purgeTaskRecord: () => taskOps.purgeTaskRecord(),
    saveSession: () => taskOps.saveSession(),
    batchRemoveTask: (gids: string[]) => taskOps.batchRemoveTask(gids),
    retryTask: (task: Aria2Task) => resubmitTerminalTask(task, 'retry'),
    redownloadTask: (task: Aria2Task) => resubmitTerminalTask(task, 'redownload'),

    registerTorrentSource,
    consumeTorrentSource,
    hasActiveTasks: () => taskOps.hasActiveTasks(),
    hasPausedTasks: () => taskOps.hasPausedTasks(),
  }
})
