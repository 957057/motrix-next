/** @fileoverview Unit tests for TaskStore with mocked TaskApi. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
let useTaskStore: typeof import('../task').useTaskStore
import type { Aria2Task, Aria2Peer, TaskStatus, HistoryRecord } from '@shared/types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock history store (DB-primary architecture) ─────────────────────
const mockHistoryFns = {
  init: vi.fn().mockResolvedValue(undefined),
  addRecord: vi.fn().mockResolvedValue(undefined),
  getRecords: vi.fn().mockResolvedValue([] as HistoryRecord[]),
  removeRecord: vi.fn().mockResolvedValue(undefined),
  clearRecords: vi.fn().mockResolvedValue(undefined),
  removeStaleRecords: vi.fn().mockResolvedValue(undefined),
  checkIntegrity: vi.fn().mockResolvedValue('ok'),
  recordTaskBirth: vi.fn().mockResolvedValue(undefined),
  loadBirthRecords: vi.fn().mockResolvedValue([]),
  getSchemaVersion: vi.fn().mockResolvedValue(2),
  removeByInfoHash: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@/stores/history', () => ({
  useHistoryStore: () => mockHistoryFns,
}))

const mockHttpAuthFns = {
  findByUrl: vi.fn().mockResolvedValue(null),
  markUsed: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@/stores/httpAuth', () => ({
  useHttpAuthStore: () => mockHttpAuthFns,
}))

const makeMockTask = (gid: string, status: TaskStatus = 'active', extra: Partial<Aria2Task> = {}): Aria2Task => ({
  gid,
  status,
  totalLength: '1000',
  completedLength: '500',
  uploadLength: '0',
  downloadSpeed: '1000',
  uploadSpeed: '0',
  connections: '1',
  numSeeders: '0',
  dir: '/tmp',
  files: [],
  bittorrent: undefined,
  infoHash: undefined,
  errorCode: undefined,
  errorMessage: undefined,
  numPieces: undefined,
  pieceLength: undefined,
  followedBy: undefined,
  following: undefined,
  belongsTo: undefined,
  ...extra,
})

function createMockApi() {
  return {
    queryTasks: vi.fn().mockResolvedValue({
      tasks: [makeMockTask('gid1'), makeMockTask('gid2')],
      history: [],
      gids: ['gid1', 'gid2'],
      counts: { all: 2, progress: 2, failed: 0, completed: 0 },
      total: 2,
      page: 1,
      selections: [],
    }),
    fetchTaskList: vi.fn().mockResolvedValue([makeMockTask('gid1'), makeMockTask('gid2')]),
    fetchTaskItem: vi.fn().mockResolvedValue(makeMockTask('gid1')),
    fetchTaskItemWithPeers: vi.fn().mockResolvedValue({ ...makeMockTask('gid1'), peers: [] as Aria2Peer[] }),
    fetchActiveTaskList: vi.fn().mockResolvedValue([]),
    addUri: vi.fn().mockResolvedValue(['gid3']),
    addUriAtomic: vi.fn().mockResolvedValue('gid3'),
    addTorrent: vi.fn().mockResolvedValue('gid4'),
    getOption: vi.fn().mockResolvedValue({}),
    changeOption: vi.fn().mockResolvedValue(undefined),
    getFiles: vi.fn().mockResolvedValue([]),
    removeTask: vi.fn().mockResolvedValue('gid1'),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    batchDeleteTasks: vi.fn().mockResolvedValue({ succeeded: ['gid1', 'gid2'], failed: [] }),
    finishSharing: vi.fn().mockResolvedValue(undefined),
    batchFinishSharing: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    forcePauseTask: vi.fn().mockResolvedValue('gid1'),
    forcePauseAll: vi.fn().mockResolvedValue('OK'),
    pauseTask: vi.fn().mockResolvedValue('gid1'),
    retryMedia: vi.fn().mockResolvedValue('gid1'),
    resumeTask: vi.fn().mockResolvedValue('gid1'),
    resumeEligible: vi.fn().mockResolvedValue({ resumed: 1, blocked: 0 }),
    removeTaskRecord: vi.fn().mockResolvedValue('OK'),
    purgeTaskRecords: vi.fn().mockResolvedValue(undefined),
    saveSession: vi.fn().mockResolvedValue('OK'),
  }
}

describe('TaskStore', () => {
  let store: ReturnType<typeof useTaskStore>
  let mockApi: ReturnType<typeof createMockApi>

  beforeEach(async () => {
    vi.resetModules()
    ;({ useTaskStore } = await import('../task'))
    setActivePinia(createPinia())
    const { useDatabaseStore } = await import('@/stores/database')
    useDatabaseStore().phase = 'ready'
    store = useTaskStore()
    mockApi = createMockApi()
    store.setApi(mockApi)
    store.currentList = 'progress'
    // Reset history mock between tests
    Object.values(mockHistoryFns).forEach((fn) => fn.mockClear())
    mockHistoryFns.getRecords.mockResolvedValue([])
    mockHistoryFns.recordTaskBirth.mockResolvedValue(undefined)
    mockHttpAuthFns.findByUrl.mockResolvedValue(null)
    mockHttpAuthFns.markUsed.mockResolvedValue(undefined)
  })

  it('uses native page order and counts without loading all history', async () => {
    mockApi.queryTasks.mockResolvedValueOnce({
      tasks: [makeMockTask('b'), makeMockTask('a')],
      history: [],
      gids: ['a', 'b'],
      counts: { all: 1002, progress: 2, completed: 1000, failed: 0 },
      total: 1002,
      page: 1,
      selections: [],
    })
    await store.fetchList()
    expect(store.taskList.map((task) => task.gid)).toEqual(['a', 'b'])
    expect(store.taskCounts.all).toBe(1002)
    expect(store.currentTaskPageCount()).toBe(51)
    expect(mockHistoryFns.getRecords).not.toHaveBeenCalled()
  })

  it('retains the visible snapshot on a query error and exposes the failure', async () => {
    await store.fetchList()
    mockApi.queryTasks.mockRejectedValueOnce(new Error('Database unavailable'))
    await store.fetchList()
    expect(store.taskList).toHaveLength(2)
    expect(store.queryError).toBe('Database unavailable')
  })

  it('keeps unrelated downloads refreshing during a retry', async () => {
    store.resubmittingGids = ['other-task']
    await store.fetchList()
    expect(mockApi.queryTasks).toHaveBeenCalledOnce()
    expect(store.taskList).toHaveLength(2)
  })

  it('keeps removal visible until the native operation settles', async () => {
    await store.fetchList()
    let finish!: () => void
    mockApi.deleteTask.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const operation = store.removeTask(store.taskList[0])
    expect(store.taskList).toHaveLength(2)
    expect(store.pendingGids).toEqual(['gid1'])
    finish()
    await operation
    expect(store.pendingGids).toEqual([])
  })

  it('preserves manual ordering outside the page being edited', async () => {
    const { usePreferenceStore } = await import('@/stores/preference')
    const preferences = usePreferenceStore()
    preferences.config.taskManualOrder.progress = ['a', 'b', 'c', 'd']
    const save = vi.spyOn(preferences, 'updateAndSave').mockResolvedValue(true)
    await store.saveVisiblePageManualOrder([makeMockTask('d'), makeMockTask('c')])
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ taskManualOrder: expect.objectContaining({ progress: ['a', 'b', 'd', 'c'] }) }),
    )
  })

  // ─── addUri / addTorrent ────────────────────────────────

  it('addUri calls API and refreshes list', async () => {
    await store.addUri({ uris: ['http://example.com/file.zip'], outs: [], options: {} })
    expect(mockApi.addUri).toHaveBeenCalled()
    expect(mockApi.queryTasks).toHaveBeenCalled()
  })

  it('addTorrent calls API, refreshes, and returns gid', async () => {
    const gid = await store.addTorrent({ torrent: 'base64data', options: {} })
    expect(mockApi.addTorrent).toHaveBeenCalledWith({ torrent: 'base64data', options: {} })
    expect(gid).toBe('gid4')
    expect(mockApi.queryTasks).toHaveBeenCalled()
  })

  it('addMagnetUri forces integrity checking for the follow-up BitTorrent download', async () => {
    const gid = await store.addMagnetUri({ uri: 'magnet:?xt=urn:btih:abc123', options: { dir: '/dl' } })

    expect(gid).toBe('gid3')
    expect(mockApi.addUri).toHaveBeenCalledWith({
      uris: ['magnet:?xt=urn:btih:abc123'],
      outs: [],
      options: { dir: '/dl', 'pause-metadata': 'true', 'check-integrity': 'true', 'force-save': 'true' },
    })
    const { useTaskSelectionStore } = await import('@/stores/taskSelection')
    const pending = [{ kind: 'bt' as const, gid: 'gid3' }]
    useTaskSelectionStore().reconcile(pending, pending)
    expect(useTaskSelectionStore().queue).toEqual(pending)
  })

  it('captures manual selection for a new magnet without automatic prompting', async () => {
    const { useTaskSelectionStore } = await import('@/stores/taskSelection')
    const { usePreferenceStore } = await import('@/stores/preference')
    usePreferenceStore().updatePreference({ magnetFileSelectionPolicy: 'manual' })

    await store.addMagnetUri({ uri: 'magnet:?xt=urn:btih:abc123', options: { dir: '/dl' } })

    const pending = [{ kind: 'bt' as const, gid: 'gid3' }]
    useTaskSelectionStore().reconcile(pending, pending)
    expect(useTaskSelectionStore().queue).toEqual([])
  })

  it('lets aria2 download every magnet file without creating selection state', async () => {
    const { useTaskSelectionStore } = await import('@/stores/taskSelection')
    const { usePreferenceStore } = await import('@/stores/preference')
    usePreferenceStore().updatePreference({ magnetFileSelectionPolicy: 'download-all' })

    await store.addMagnetUri({ uri: 'magnet:?xt=urn:btih:abc123', options: { dir: '/dl' } })

    expect(mockApi.addUri).toHaveBeenCalledWith({
      uris: ['magnet:?xt=urn:btih:abc123'],
      outs: [],
      options: { dir: '/dl', 'pause-metadata': 'false', 'check-integrity': 'true', 'force-save': 'true' },
    })
    expect(useTaskSelectionStore().pending).toEqual([])
    expect(useTaskSelectionStore().queue).toEqual([])
  })

  it('pauses download-all magnets for native metadata classification', async () => {
    const { useTaskSelectionStore } = await import('@/stores/taskSelection')
    const { usePreferenceStore } = await import('@/stores/preference')
    usePreferenceStore().updatePreference({ magnetFileSelectionPolicy: 'download-all' })

    await store.addMagnetUri({
      uri: 'magnet:?xt=urn:btih:abc123',
      options: { dir: '/dl' },
      fileCategory: {
        enabled: true,
        categories: [{ label: 'Videos', extensions: ['mkv'], directory: '/dl/Videos' }],
      },
    })

    expect(mockApi.addUri).toHaveBeenCalledWith({
      uris: ['magnet:?xt=urn:btih:abc123'],
      outs: [],
      options: { dir: '/dl', 'pause-metadata': 'true', 'check-integrity': 'true', 'force-save': 'true' },
    })
    const pending = [{ kind: 'bt' as const, gid: 'gid3' }]
    useTaskSelectionStore().reconcile(pending, pending)
    expect(useTaskSelectionStore().queue).toEqual([])
  })

  // ─── pauseAllTask / resumeAllTask ───────────────────────

  it('pauseAllTask uses the native engine-wide pause operation', async () => {
    await store.fetchList()
    await store.pauseAllTask()
    expect(mockApi.forcePauseAll).toHaveBeenCalledOnce()
    expect(mockApi.forcePauseTask).not.toHaveBeenCalled()
    expect(mockApi.saveSession).toHaveBeenCalled()
  })

  it('pauseAllTask remains native when the queue contains sharing tasks', async () => {
    mockApi.fetchTaskList.mockResolvedValueOnce([
      makeMockTask('dl-1', 'active'),
      makeMockTask('seed-1', 'active', {
        bittorrent: { info: { name: 'movie.mkv' } },
        seeder: 'true',
      }),
    ])
    await store.fetchList()
    await store.pauseAllTask()
    expect(mockApi.forcePauseAll).toHaveBeenCalledOnce()
  })

  it('resumeAllTask resumes eligible paused tasks, refreshes, and saves session', async () => {
    mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('paused-1', 'paused')])
    await store.fetchList()
    await store.resumeAllTask()
    expect(mockApi.resumeEligible).toHaveBeenCalledOnce()
    expect(mockApi.queryTasks).toHaveBeenCalled()
    expect(mockApi.saveSession).toHaveBeenCalled()
  })

  // ─── showTaskDetail / hideTaskDetail ────────────────────

  it('showTaskDetail sets visibility, gid, and current task item', () => {
    const task = makeMockTask('gid1')
    store.showTaskDetail(task)
    expect(store.taskDetailVisible).toBe(true)
    expect(store.currentTaskGid).toBe('gid1')
    expect(store.currentTaskItem?.gid).toBe('gid1')
  })

  it('hideTaskDetail resets visibility', () => {
    store.showTaskDetail(makeMockTask('gid1'))
    store.hideTaskDetail()
    expect(store.taskDetailVisible).toBe(false)
  })

  // ─── changeCurrentList ──────────────────────────────────

  it('retains the old page while loading and ignores stale scope results', async () => {
    store.taskList = [makeMockTask('visible')]
    let resolveOld!: (value: unknown) => void
    mockApi.queryTasks.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    store.displayedList = 'progress'
    const old = store.fetchList()
    expect(store.listPending).toBe(true)
    expect(store.displayedList).toBe('progress')
    expect(store.taskList[0].gid).toBe('visible')
    await store.changeCurrentList('completed')
    expect(store.displayedList).toBe('completed')
    expect(store.listPending).toBe(false)
    resolveOld({
      tasks: [makeMockTask('stale')],
      history: [],
      gids: ['stale'],
      total: 1,
      page: 1,
      counts: { all: 1, progress: 1, failed: 0, completed: 0 },
      selections: [],
    })
    await old
    expect(store.taskList.map((task) => task.gid)).not.toContain('stale')
    expect(store.displayedList).toBe('completed')
  })

  it('removeTask calls API and refreshes list', async () => {
    const task = makeMockTask('gid1')
    await store.removeTask(task)
    expect(mockApi.deleteTask).toHaveBeenCalledWith({ gid: 'gid1', infoHash: undefined })
    expect(mockApi.queryTasks).toHaveBeenCalled()
    expect(mockApi.saveSession).toHaveBeenCalled()
  })

  it('removeTask hides detail if removing current detail task', async () => {
    const task = makeMockTask('gid1')
    store.showTaskDetail(task)
    expect(store.taskDetailVisible).toBe(true)
    await store.removeTask(task)
    expect(store.taskDetailVisible).toBe(false)
  })

  it('removeTask always refreshes list even if API throws', async () => {
    mockApi.deleteTask.mockRejectedValueOnce(new Error('not found'))
    const task = makeMockTask('gid1')
    await expect(store.removeTask(task)).rejects.toThrow('not found')
    expect(mockApi.queryTasks).toHaveBeenCalled()
  })

  // ─── pauseTask / resumeTask ─────────────────────────────

  it('pauseTask uses forcePause for BT tasks', async () => {
    const btTask = makeMockTask('gid1', 'active', { bittorrent: { info: { name: 'test' } } })
    await store.pauseTask(btTask)
    expect(mockApi.forcePauseTask).toHaveBeenCalledWith({ gid: 'gid1' })
    expect(mockApi.pauseTask).not.toHaveBeenCalled()
  })

  it('pauseTask uses regular pause for HTTP tasks', async () => {
    const httpTask = makeMockTask('gid1')
    await store.pauseTask(httpTask)
    expect(mockApi.pauseTask).toHaveBeenCalledWith({ gid: 'gid1' })
    expect(mockApi.forcePauseTask).not.toHaveBeenCalled()
  })

  it('resumeTask calls API, refreshes, and saves session', async () => {
    const task = makeMockTask('gid1')
    await store.resumeTask(task)
    expect(mockApi.resumeTask).toHaveBeenCalledWith({ gid: 'gid1' })
    expect(mockApi.queryTasks).toHaveBeenCalled()
    expect(mockApi.saveSession).toHaveBeenCalled()
  })

  // ─── toggleTask ─────────────────────────────────────────

  it('toggleTask pauses active task', async () => {
    const task = makeMockTask('gid1', 'active')
    await store.toggleTask(task)
    expect(mockApi.pauseTask).toHaveBeenCalled()
  })

  it('toggleTask resumes paused task', async () => {
    const task = makeMockTask('gid1', 'paused')
    await store.toggleTask(task)
    expect(mockApi.resumeTask).toHaveBeenCalled()
  })

  it('toggleTask pauses waiting task', async () => {
    const task = makeMockTask('gid1', 'waiting')
    await store.toggleTask(task)
    expect(mockApi.pauseTask).toHaveBeenCalledWith({ gid: 'gid1' })
    expect(mockApi.resumeTask).not.toHaveBeenCalled()
  })

  // ─── batch operations ───────────────────────────────────

  it('batchRemoveTask calls API with gids and saves session', async () => {
    await store.batchRemoveTask(['gid1', 'gid2'])
    expect(mockApi.batchDeleteTasks).toHaveBeenCalledWith({
      tasks: [
        { gid: 'gid1', infoHash: undefined },
        { gid: 'gid2', infoHash: undefined },
      ],
    })
    expect(mockApi.deleteTask).not.toHaveBeenCalled()
    expect(mockApi.saveSession).toHaveBeenCalled()
  })

  // ─── updateCurrentTaskItem ──────────────────────────────

  it('updateCurrentTaskItem sets task, files, and peers', () => {
    const task = makeMockTask('gid1', 'active', {
      files: [{ index: '1', path: '/tmp/f1', length: '100', completedLength: '50', selected: 'true', uris: [] }],
    })
    ;(task as Aria2Task & { peers?: Aria2Peer[] }).peers = [
      {
        peerId: '-qB1234-',
        ip: '1.2.3.4',
        port: '6881',
        bitfield: 'ff',
        amChoking: 'false',
        peerChoking: 'false',
        downloadSpeed: '100',
        uploadSpeed: '0',
        seeder: 'false',
        state: 'connected',
        transport: 'tcp',
        encryption: 'plain',
        sources: ['tracker'],
        progress: '0.500000',
        flags: 'D',
        incoming: 'false',
        downloaded: '100',
        uploaded: '0',
        completedLength: '50',
      },
    ]
    store.updateCurrentTaskItem(task)
    expect(store.currentTaskItem?.gid).toBe('gid1')
    expect(store.currentTaskFiles).toHaveLength(1)
  })

  it('updateCurrentTaskItem with null clears all', () => {
    store.showTaskDetail(makeMockTask('gid1'))
    store.updateCurrentTaskItem(null)
    expect(store.currentTaskItem).toBeNull()
    expect(store.currentTaskFiles).toEqual([])
    expect(store.currentTaskPeers).toEqual([])
  })

  // ─── removeTaskRecord ───────────────────────────────────

  it('removeTaskRecord uses the unified deletion transaction', async () => {
    const task = makeMockTask('gid1', 'complete')
    await store.removeTaskRecord(task)
    expect(mockApi.deleteTask).toHaveBeenCalledWith({ gid: 'gid1', infoHash: undefined })
  })

  it('removeTaskRecord hides the current task detail', async () => {
    const task = makeMockTask('gid1', 'complete')
    store.showTaskDetail(task)
    await store.removeTaskRecord(task)
    expect(store.taskDetailVisible).toBe(false)
  })

  // ─── purgeTaskRecord ────────────────────────────────────

  it('purgeTaskRecord uses the native application transaction', async () => {
    await store.purgeTaskRecord()
    expect(mockApi.purgeTaskRecords).toHaveBeenCalledOnce()
    expect(mockHistoryFns.clearRecords).not.toHaveBeenCalled()
  })

  it('purgeTaskRecord surfaces a native transaction failure', async () => {
    mockApi.purgeTaskRecords.mockRejectedValueOnce(new Error('IPC fail'))
    await expect(store.purgeTaskRecord()).rejects.toThrow('IPC fail')
  })

  // ─── saveSession ────────────────────────────────────────

  it('saveSession calls API', () => {
    store.saveSession()
    expect(mockApi.saveSession).toHaveBeenCalled()
  })
  // ─── terminal resubmission ─────────────────────────────

  it('retryTask coalesces repeated clicks into one submission', async () => {
    const task = makeMockTask('stopped1', 'error', {
      files: [
        {
          index: '1',
          path: '/tmp/file.zip',
          length: '1000',
          completedLength: '0',
          selected: 'true',
          uris: [{ uri: 'http://example.com/file.zip', status: 'used' }],
        },
      ],
    })
    mockApi.addUriAtomic.mockResolvedValue('new-gid-1')
    mockApi.getOption.mockResolvedValue({ dir: '/tmp' })
    const pending = new Promise<Aria2Task>((resolve) => {
      setTimeout(() => resolve(makeMockTask('new-gid-1', 'active')), 10)
    })
    mockApi.fetchTaskItem.mockReturnValue(pending)
    const first = store.retryTask(task)
    const second = store.retryTask(task)
    await Promise.all([first, second])

    expect(mockApi.addUriAtomic).toHaveBeenCalledTimes(1)
    expect(mockApi.addUriAtomic).toHaveBeenCalledWith({
      uris: ['http://example.com/file.zip'],
      options: { dir: '/tmp', continue: 'true', allowOverwrite: 'false', autoFileRenaming: 'false' },
    })
    expect(mockApi.removeTaskRecord).toHaveBeenCalledWith({ gid: 'stopped1' })
    expect(mockApi.queryTasks).toHaveBeenCalled()
  })

  it('redownloadTask submits each URI separately with fresh-file options', async () => {
    const task = makeMockTask('stopped2', 'error', {
      files: [
        {
          index: '1',
          path: '/tmp/a.zip',
          length: '500',
          completedLength: '0',
          selected: 'true',
          uris: [{ uri: 'http://example.com/a.zip', status: 'used' }],
        },
        {
          index: '2',
          path: '/tmp/b.zip',
          length: '500',
          completedLength: '0',
          selected: 'true',
          uris: [{ uri: 'http://example.com/b.zip', status: 'used' }],
        },
      ],
    })
    mockApi.addUriAtomic.mockResolvedValueOnce('new-a').mockResolvedValueOnce('new-b')
    mockApi.getOption.mockResolvedValue({ dir: '/tmp' })
    mockApi.fetchTaskItem.mockImplementation(({ gid }) => Promise.resolve(makeMockTask(gid, 'active')))
    await store.redownloadTask({ ...task, status: 'complete' })

    expect(mockApi.addUriAtomic).toHaveBeenCalledTimes(2)
    expect(mockApi.addUriAtomic).toHaveBeenNthCalledWith(1, {
      uris: ['http://example.com/a.zip'],
      options: { dir: '/tmp', continue: 'false', allowOverwrite: 'false', autoFileRenaming: 'true' },
    })
    expect(mockApi.addUriAtomic).toHaveBeenNthCalledWith(2, {
      uris: ['http://example.com/b.zip'],
      options: { dir: '/tmp', continue: 'false', allowOverwrite: 'false', autoFileRenaming: 'true' },
    })
    expect(mockApi.removeTaskRecord).toHaveBeenCalledWith({ gid: 'stopped2' })
  })

  it('retryTask rolls back created tasks on partial failure', async () => {
    const task = makeMockTask('stopped3', 'error', {
      files: [
        {
          index: '1',
          path: '/tmp/a.zip',
          length: '500',
          completedLength: '0',
          selected: 'true',
          uris: [{ uri: 'http://example.com/a.zip', status: 'used' }],
        },
        {
          index: '2',
          path: '/tmp/b.zip',
          length: '500',
          completedLength: '0',
          selected: 'true',
          uris: [{ uri: 'http://example.com/b.zip', status: 'used' }],
        },
      ],
    })
    // First URI succeeds, second fails
    mockApi.addUriAtomic.mockResolvedValueOnce('new-a').mockRejectedValueOnce(new Error('network error'))

    mockApi.fetchTaskItem.mockImplementation(({ gid }) => Promise.resolve(makeMockTask(gid, 'active')))
    await expect(store.retryTask(task)).rejects.toThrow('network error')

    // Rollback: the successfully created task should be removed
    expect(mockApi.removeTask).toHaveBeenCalledWith({ gid: 'new-a' })
    // Old record must NOT be deleted since restart failed
    expect(mockApi.removeTaskRecord).not.toHaveBeenCalled()
  })

  it('retryTask rejects non-error tasks', async () => {
    const task = makeMockTask('active1', 'active')
    await expect(store.retryTask(task)).rejects.toThrow('Cannot retry')
    expect(mockApi.removeTaskRecord).not.toHaveBeenCalled()
  })

  // ─── hasActiveTasks ─────────────────────────────────────

  describe('hasActiveTasks', () => {
    it('returns true when active tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('a1', 'active')])
      expect(await store.hasActiveTasks()).toBe(true)
    })

    it('returns true when waiting tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('w1', 'waiting')])
      expect(await store.hasActiveTasks()).toBe(true)
    })

    it('returns false when only paused/completed tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('p1', 'paused'), makeMockTask('c1', 'complete')])
      expect(await store.hasActiveTasks()).toBe(false)
    })

    it('returns false when no tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([])
      expect(await store.hasActiveTasks()).toBe(false)
    })

    it('returns false on API error', async () => {
      mockApi.fetchTaskList.mockRejectedValueOnce(new Error('RPC fail'))
      expect(await store.hasActiveTasks()).toBe(false)
    })

    it('queries globally regardless of current tab', async () => {
      // Switch to completed tab first
      mockApi.fetchTaskList.mockResolvedValue([])
      await store.changeCurrentList('stopped')
      mockApi.fetchTaskList.mockReset()

      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('a1', 'active')])
      expect(await store.hasActiveTasks()).toBe(true)
      // Must query active type, not the current 'stopped' tab
      expect(mockApi.fetchTaskList).toHaveBeenCalledWith({ type: 'active' })
    })
  })

  // ─── hasPausedTasks ─────────────────────────────────────

  describe('hasPausedTasks', () => {
    it('returns true when paused tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('p1', 'paused')])
      expect(await store.hasPausedTasks()).toBe(true)
    })

    it('returns false when only active/waiting tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('a1', 'active'), makeMockTask('w1', 'waiting')])
      expect(await store.hasPausedTasks()).toBe(false)
    })

    it('returns false when no tasks exist', async () => {
      mockApi.fetchTaskList.mockResolvedValueOnce([])
      expect(await store.hasPausedTasks()).toBe(false)
    })

    it('returns false on API error', async () => {
      mockApi.fetchTaskList.mockRejectedValueOnce(new Error('RPC fail'))
      expect(await store.hasPausedTasks()).toBe(false)
    })

    it('queries globally regardless of current tab', async () => {
      // Switch to completed tab
      mockApi.fetchTaskList.mockResolvedValue([])
      await store.changeCurrentList('stopped')
      mockApi.fetchTaskList.mockReset()

      mockApi.fetchTaskList.mockResolvedValueOnce([makeMockTask('p1', 'paused')])
      expect(await store.hasPausedTasks()).toBe(true)
      expect(mockApi.fetchTaskList).toHaveBeenCalledWith({ type: 'active' })
    })
  })

  // NOTE: Task lifecycle scanning (completion + error detection) has been
  // migrated to the app-level useTaskLifecycleService. Tests are in
  // src/composables/__tests__/useTaskLifecycleService.test.ts

  // ── registerTorrentSource / consumeTorrentSource ────────────────────

  describe('torrent source path tracking', () => {
    it('registers and consumes a source path by infoHash', () => {
      store.registerTorrentSource('abc123', '/downloads/movie.torrent')
      expect(store.consumeTorrentSource('abc123')).toBe('/downloads/movie.torrent')
    })

    it('consumeTorrentSource returns undefined for unknown hash', () => {
      expect(store.consumeTorrentSource('nonexistent')).toBeUndefined()
    })

    it('consumeTorrentSource deletes the entry after first consumption', () => {
      store.registerTorrentSource('abc123', '/downloads/movie.torrent')
      store.consumeTorrentSource('abc123')
      expect(store.consumeTorrentSource('abc123')).toBeUndefined()
    })

    it('overwrites previous path when same hash is registered twice', () => {
      store.registerTorrentSource('abc123', '/old/path.torrent')
      store.registerTorrentSource('abc123', '/new/path.torrent')
      expect(store.consumeTorrentSource('abc123')).toBe('/new/path.torrent')
    })

    it('tracks multiple hashes independently', () => {
      store.registerTorrentSource('hash1', '/path/a.torrent')
      store.registerTorrentSource('hash2', '/path/b.torrent')
      expect(store.consumeTorrentSource('hash1')).toBe('/path/a.torrent')
      expect(store.consumeTorrentSource('hash2')).toBe('/path/b.torrent')
    })
  })
  it('sets sort direction explicitly and preserves other scopes', async () => {
    const { usePreferenceStore } = await import('@/stores/preference')
    const preferences = usePreferenceStore()
    const completed = { ...preferences.config.taskSort.completed }
    const persist = vi.spyOn(preferences, 'updateAndSave').mockImplementation(async (config) => {
      preferences.updatePreference(config)
      return true
    })
    await store.setCurrentSort('name', 'asc')
    expect(preferences.config.taskSort.progress).toEqual({ field: 'name', direction: 'asc' })
    await store.setCurrentSort('name', 'asc')
    expect(persist).toHaveBeenCalledTimes(1)
    await store.setCurrentSort('name', 'desc')
    expect(preferences.config.taskSort.progress.direction).toBe('desc')
    expect(preferences.config.taskSort.completed).toEqual(completed)
  })
  it('does not change the displayed sort when persistence fails', async () => {
    const { usePreferenceStore } = await import('@/stores/preference')
    const preferences = usePreferenceStore()
    const previous = { ...preferences.config.taskSort.progress }
    vi.spyOn(preferences, 'updateAndSave').mockResolvedValue(false)
    await expect(store.setCurrentSort('name', 'asc')).rejects.toThrow('Could not save task sorting')
    expect(preferences.config.taskSort.progress).toEqual(previous)
    expect(mockApi.queryTasks).not.toHaveBeenCalled()
  })
})
