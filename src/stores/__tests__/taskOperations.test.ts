/**
 * @fileoverview Behavioral tests for taskOperations.ts CRUD operations.
 *
 * Strategy:
 *  - Mock TaskApi with vi.fn() stubs per method
 *  - Mock useHistoryStore via vi.mock
 *  - Use dependency injection to pass mocked deps into createTaskOperations
 *  - AAA pattern: Arrange (build task + deps), Act (call operation), Assert (verify calls)
 *  - Cover: success path, error path (API throws), edge cases (empty arrays, guard conditions)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { ref } from 'vue'
import { TASK_STATUS } from '@shared/constants'
import type { Aria2Task, TaskApi, TaskStatus } from '@shared/types'
import { createTaskOperations } from '../task/operations'

// ── Mock history store ─────────────────────────────────────────────
const mockAddRecord = vi.fn().mockResolvedValue(undefined)
const mockRemoveRecord = vi.fn().mockResolvedValue(undefined)
const mockClearRecords = vi.fn().mockResolvedValue(undefined)
const mockRemoveByInfoHash = vi.fn().mockResolvedValue(undefined)
const mockRemoveBirthRecords = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/history', () => ({
  useHistoryStore: () => ({
    addRecord: mockAddRecord,
    removeRecord: mockRemoveRecord,
    clearRecords: mockClearRecords,
    removeByInfoHash: mockRemoveByInfoHash,
    removeBirthRecords: mockRemoveBirthRecords,
  }),
}))

// ── Mock P2P completion record ──────────────────────────────────────
// ── Helpers ────────────────────────────────────────────────────────

function createMockApi(): TaskApi {
  return {
    fetchTaskList: vi.fn().mockResolvedValue([]),
    fetchTaskItem: vi.fn().mockResolvedValue({}),
    fetchTaskItemWithPeers: vi.fn().mockResolvedValue({}),
    fetchActiveTaskList: vi.fn().mockResolvedValue([]),
    addUri: vi.fn().mockResolvedValue([]),
    addUriAtomic: vi.fn().mockResolvedValue(''),
    addTorrent: vi.fn().mockResolvedValue(''),
    getOption: vi.fn().mockResolvedValue({}),
    changeOption: vi.fn().mockResolvedValue(undefined),
    getFiles: vi.fn().mockResolvedValue([]),
    removeTask: vi.fn().mockResolvedValue('OK'),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    finishSharing: vi.fn().mockResolvedValue(undefined),
    forcePauseTask: vi.fn().mockResolvedValue('OK'),
    pauseTask: vi.fn().mockResolvedValue('OK'),
    resumeTask: vi.fn().mockResolvedValue('OK'),
    batchResumeTask: vi.fn().mockResolvedValue([]),
    batchPauseTask: vi.fn().mockResolvedValue([]),
    batchForcePauseTask: vi.fn().mockResolvedValue([]),
    batchRemoveTask: vi.fn().mockResolvedValue([]),
    removeTaskRecord: vi.fn().mockResolvedValue('OK'),
    purgeTaskRecord: vi.fn().mockResolvedValue('OK'),
    saveSession: vi.fn().mockResolvedValue('OK'),
  }
}

function makeTask(overrides: Record<string, unknown> = {}): Aria2Task {
  return {
    gid: 'abc123',
    status: TASK_STATUS.ACTIVE as TaskStatus,
    totalLength: '1024',
    completedLength: '512',
    downloadSpeed: '100',
    uploadSpeed: '0',
    connections: '1',
    dir: '/downloads',
    files: [],
    ...overrides,
  } as unknown as Aria2Task
}

function createDeps(api: TaskApi) {
  const taskList = ref<Aria2Task[]>([])
  const currentTaskGid = ref('')
  const hideTaskDetail = vi.fn()
  const fetchList = vi.fn().mockResolvedValue(undefined)
  const setTaskRemoving = vi.fn()
  return { api, taskList, currentTaskGid, hideTaskDetail, fetchList, setTaskRemoving }
}

// ═══════════════════════════════════════════════════════════════════
// removeTask
// ═══════════════════════════════════════════════════════════════════

describe('removeTask', () => {
  it('deletes through the state-independent transaction', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.removeTask(makeTask({ gid: 'task-1', infoHash: 'hash-1' }))
    expect(api.deleteTask).toHaveBeenCalledWith({ gid: 'task-1', infoHash: 'hash-1' })
    expect(deps.fetchList).toHaveBeenCalledOnce()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('restores the list when deletion fails', async () => {
    const api = createMockApi()
    ;(api.deleteTask as Mock).mockRejectedValueOnce(new Error('network'))
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await expect(ops.removeTask(makeTask())).rejects.toThrow('network')
    expect(deps.fetchList).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
describe('finishSharing', () => {
  it('finishes seeding without deleting the completed record', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    const task = makeTask({ gid: 'seed-1', seeder: 'true', bittorrent: { state: 'seeding' } })

    await ops.finishSharing(task)

    expect(api.finishSharing).toHaveBeenCalledWith({ gid: 'seed-1' })
    expect(api.deleteTask).not.toHaveBeenCalled()
    expect(deps.setTaskRemoving).not.toHaveBeenCalled()
    expect(deps.fetchList).toHaveBeenCalledOnce()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })
})

// pauseTask
// ═══════════════════════════════════════════════════════════════════

describe('pauseTask', () => {
  let api: TaskApi
  let deps: ReturnType<typeof createDeps>
  let ops: ReturnType<typeof createTaskOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createMockApi()
    deps = createDeps(api)
    ops = createTaskOperations(deps)
  })

  it('uses forcePauseTask for BitTorrent tasks', async () => {
    const btTask = makeTask({ bittorrent: { info: { name: 'ubuntu.torrent' } } } as Partial<Aria2Task>)
    await ops.pauseTask(btTask)
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: btTask.gid })
    expect(api.pauseTask).not.toHaveBeenCalled()
  })

  it('uses pauseTask for non-BT tasks', async () => {
    const httpTask = makeTask()
    await ops.pauseTask(httpTask)
    expect(api.pauseTask).toHaveBeenCalledWith({ gid: httpTask.gid })
    expect(api.forcePauseTask).not.toHaveBeenCalled()
  })

  it('refreshes list and saves session after pause', async () => {
    await ops.pauseTask(makeTask())
    expect(deps.fetchList).toHaveBeenCalledOnce()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('still refreshes list even when pause fails', async () => {
    ;(api.pauseTask as Mock).mockRejectedValueOnce(new Error('fail'))
    await expect(ops.pauseTask(makeTask())).rejects.toThrow('fail')
    expect(deps.fetchList).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════
// resumeTask
// ═══════════════════════════════════════════════════════════════════

describe('resumeTask', () => {
  let api: TaskApi
  let deps: ReturnType<typeof createDeps>
  let ops: ReturnType<typeof createTaskOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createMockApi()
    deps = createDeps(api)
    ops = createTaskOperations(deps)
  })

  it('calls api.resumeTask with the gid', async () => {
    const task = makeTask({ gid: 'r-1' })
    await ops.resumeTask(task)
    expect(api.resumeTask).toHaveBeenCalledWith({ gid: 'r-1' })
  })

  it('refreshes list and saves session', async () => {
    await ops.resumeTask(makeTask())
    expect(deps.fetchList).toHaveBeenCalledOnce()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('keeps a resolved magnet paused until file selection is applied', async () => {
    const task = makeTask({
      gid: 'magnet-download',
      status: TASK_STATUS.PAUSED,
      bittorrent: { info: { name: 'Archive' }, state: 'paused', fileSelectionState: 'awaiting' },
      files: [{ index: '1', path: '/downloads/file.bin', length: '1024' }],
    })

    await expect(ops.resumeTask(task)).resolves.toBe(false)
    expect(api.getOption).not.toHaveBeenCalled()
    expect(api.resumeTask).not.toHaveBeenCalled()
  })

  it('applies magnet file selection before resuming the paused task', async () => {
    const calls: string[] = []
    vi.mocked(api.changeOption).mockImplementation(async () => {
      calls.push('select')
    })
    vi.mocked(api.resumeTask).mockImplementation(async () => {
      calls.push('resume')
      return 'OK'
    })
    const task = makeTask({ gid: 'magnet-download', status: TASK_STATUS.PAUSED })

    await ops.applyMagnetFileSelection(task, '2-9')

    expect(api.changeOption).toHaveBeenCalledWith({
      gid: 'magnet-download',
      options: { 'select-file': '2-9' },
    })
    expect(calls).toEqual(['select', 'resume'])
  })
})

// ═══════════════════════════════════════════════════════════════════
// pauseAllTask / resumeAllTask
// ═══════════════════════════════════════════════════════════════════

describe('pauseAllTask', () => {
  it('pauses non-seeding active tasks individually via forcePauseTask', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    deps.taskList.value = [
      makeTask({ gid: 'dl-1', status: TASK_STATUS.ACTIVE }),
      makeTask({ gid: 'dl-2', status: TASK_STATUS.WAITING }),
    ] as Aria2Task[]
    const ops = createTaskOperations(deps)
    await ops.pauseAllTask()
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: 'dl-1' })
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: 'dl-2' })
    expect(deps.fetchList).toHaveBeenCalledOnce()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('pauses seeding tasks with the rest of the active queue', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    deps.taskList.value = [
      makeTask({ gid: 'dl-1', status: TASK_STATUS.ACTIVE }),
      makeTask({
        gid: 'seed-1',
        status: TASK_STATUS.ACTIVE,
        bittorrent: { info: { name: 'movie.mkv' } },
        seeder: 'true',
      }),
    ] as Aria2Task[]
    const ops = createTaskOperations(deps)
    await ops.pauseAllTask()
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: 'dl-1' })
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: 'seed-1' })
    expect(api.forcePauseTask).toHaveBeenCalledTimes(2)
  })

  it('pauses a queue containing only seeding tasks', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    deps.taskList.value = [
      makeTask({
        gid: 'seed-only',
        status: TASK_STATUS.ACTIVE,
        bittorrent: { info: { name: 'iso.torrent' } },
        seeder: 'true',
      }),
    ] as Aria2Task[]
    const ops = createTaskOperations(deps)
    await ops.pauseAllTask()
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: 'seed-only' })
  })
})

describe('resumeAllTask', () => {
  it('resumes eligible paused tasks, then refreshes and saves', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    deps.taskList.value = [makeTask({ gid: 'paused-1', status: TASK_STATUS.PAUSED })]
    const ops = createTaskOperations(deps)
    await expect(ops.resumeAllTask()).resolves.toEqual({ resumed: 1, blocked: 0 })
    expect(api.batchResumeTask).toHaveBeenCalledWith({ gids: ['paused-1'] })
    expect(deps.fetchList).toHaveBeenCalledOnce()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════
// toggleTask
// ═══════════════════════════════════════════════════════════════════

describe('toggleTask', () => {
  let api: TaskApi
  let deps: ReturnType<typeof createDeps>
  let ops: ReturnType<typeof createTaskOperations>

  beforeEach(() => {
    vi.clearAllMocks()
    api = createMockApi()
    deps = createDeps(api)
    ops = createTaskOperations(deps)
  })

  it('pauses an active task', async () => {
    const task = makeTask({ status: TASK_STATUS.ACTIVE })
    await ops.toggleTask(task)
    expect(api.pauseTask).toHaveBeenCalled()
  })

  it('resumes a paused task', async () => {
    const task = makeTask({ status: TASK_STATUS.PAUSED })
    await ops.toggleTask(task)
    expect(api.resumeTask).toHaveBeenCalledWith({ gid: task.gid })
  })

  it('pauses a waiting task', async () => {
    const task = makeTask({ status: TASK_STATUS.WAITING })
    await ops.toggleTask(task)
    expect(api.pauseTask).toHaveBeenCalledWith({ gid: task.gid })
    expect(api.resumeTask).not.toHaveBeenCalled()
  })

  it('does nothing for a completed task', async () => {
    const task = makeTask({ status: TASK_STATUS.COMPLETE })
    const result = ops.toggleTask(task)
    expect(result).toBeUndefined()
    expect(api.pauseTask).not.toHaveBeenCalled()
    expect(api.resumeTask).not.toHaveBeenCalled()
  })

  it('does nothing for an errored task', async () => {
    const task = makeTask({ status: TASK_STATUS.ERROR })
    ops.toggleTask(task)
    expect(api.pauseTask).not.toHaveBeenCalled()
    expect(api.resumeTask).not.toHaveBeenCalled()
  })

  it('pauses an active seeding task', async () => {
    const task = makeTask({
      status: TASK_STATUS.ACTIVE,
      bittorrent: { info: { name: 'movie.mkv' } },
      seeder: 'true',
    })
    const result = ops.toggleTask(task)
    await result
    expect(api.forcePauseTask).toHaveBeenCalledWith({ gid: task.gid })
    expect(api.resumeTask).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════
// removeTaskRecord
// ═══════════════════════════════════════════════════════════════════

describe('removeTaskRecord', () => {
  it('uses the same deletion transaction for terminal records', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.removeTaskRecord(makeTask({ gid: 'record', status: TASK_STATUS.COMPLETE }))
    expect(api.deleteTask).toHaveBeenCalledWith({ gid: 'record', infoHash: undefined })
    expect(deps.fetchList).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════
// purgeTaskRecord
// ═══════════════════════════════════════════════════════════════════

describe('purgeTaskRecord', () => {
  it('clears all history records and purges aria2', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.purgeTaskRecord()
    expect(mockClearRecords).toHaveBeenCalledOnce()
    expect(api.purgeTaskRecord).toHaveBeenCalledOnce()
    expect(deps.fetchList).toHaveBeenCalledOnce()
  })

  it('saves session after purging all records', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.purgeTaskRecord()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('still refreshes list even if aria2 purge fails', async () => {
    const api = createMockApi()
    ;(api.purgeTaskRecord as Mock).mockRejectedValueOnce(new Error('fail'))
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.purgeTaskRecord()
    // Error is caught internally, should not throw
    expect(deps.fetchList).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════
// batchRemoveTask
// ═══════════════════════════════════════════════════════════════════

describe('batchRemoveTask', () => {
  it('deletes every gid through the unified transaction', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.batchRemoveTask(['a', 'b'])
    expect(api.deleteTask).toHaveBeenCalledTimes(2)
    expect(api.deleteTask).toHaveBeenCalledWith({ gid: 'a', infoHash: undefined })
    expect(api.deleteTask).toHaveBeenCalledWith({ gid: 'b', infoHash: undefined })
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('refreshes after a failed transaction', async () => {
    const api = createMockApi()
    ;(api.deleteTask as Mock).mockRejectedValueOnce(new Error('delete failed'))
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await expect(ops.batchRemoveTask(['a'])).rejects.toThrow('delete failed')
    expect(deps.fetchList).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════
// hasActiveTasks / hasPausedTasks
// ═══════════════════════════════════════════════════════════════════

describe('hasActiveTasks', () => {
  it('returns true when active non-seeding tasks exist', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([makeTask({ status: TASK_STATUS.ACTIVE })])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasActiveTasks()).toBe(true)
  })

  it('returns true when waiting tasks exist', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([makeTask({ status: TASK_STATUS.WAITING })])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasActiveTasks()).toBe(true)
  })

  it('returns true when only seeding tasks exist', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([
      makeTask({
        status: TASK_STATUS.ACTIVE,
        bittorrent: { info: { name: 'seed' } },
        seeder: 'true',
      }),
    ])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasActiveTasks()).toBe(true)
  })

  it('returns false when only completed tasks exist', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([makeTask({ status: TASK_STATUS.COMPLETE })])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasActiveTasks()).toBe(false)
  })

  it('returns false on API error', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockRejectedValueOnce(new Error('connection'))
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasActiveTasks()).toBe(false)
  })

  it('returns false when task list is empty', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasActiveTasks()).toBe(false)
  })
})

describe('hasPausedTasks', () => {
  it('returns true when paused tasks exist', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([makeTask({ status: TASK_STATUS.PAUSED })])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasPausedTasks()).toBe(true)
  })

  it('returns false when no paused tasks', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockResolvedValueOnce([makeTask({ status: TASK_STATUS.ACTIVE })])
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasPausedTasks()).toBe(false)
  })

  it('returns false on API error', async () => {
    const api = createMockApi()
    ;(api.fetchTaskList as Mock).mockRejectedValueOnce(new Error('err'))
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    expect(await ops.hasPausedTasks()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════
// saveSession
// ═══════════════════════════════════════════════════════════════════

describe('saveSession', () => {
  it('delegates to api.saveSession', async () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    await ops.saveSession()
    expect(api.saveSession).toHaveBeenCalledOnce()
  })

  it('returns a Promise (is async, not fire-and-forget)', () => {
    const api = createMockApi()
    const deps = createDeps(api)
    const ops = createTaskOperations(deps)
    const result = ops.saveSession()
    expect(result).toBeInstanceOf(Promise)
  })
})
