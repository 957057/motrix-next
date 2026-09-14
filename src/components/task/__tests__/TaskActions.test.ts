import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NDropdown } from 'naive-ui'
import type { Aria2Task } from '@shared/types'
import { useTaskStore } from '@/stores/task'
import { useTaskViewStore } from '@/stores/taskView'
import TaskActions from '../TaskActions.vue'

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  ready: vi.fn(() => true),
  dialog: vi.fn(),
  deleteFiles: vi.fn(),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/api/aria2', () => ({ isEngineReady: mocks.ready, batchFinishMedia: vi.fn(), saveSession: vi.fn() }))
vi.mock('@/composables/useAppMessage', () => ({ useAppMessage: () => mocks }))
vi.mock('@/composables/useFileDelete', () => ({ deleteTaskFiles: mocks.deleteFiles }))
vi.mock('naive-ui', async (original) => ({
  ...(await original<typeof import('naive-ui')>()),
  useDialog: () => ({ error: mocks.dialog, warning: mocks.dialog, info: mocks.dialog }),
}))

function task(gid: string): Aria2Task {
  return {
    gid,
    status: 'active',
    totalLength: '100',
    completedLength: '10',
    uploadLength: '0',
    downloadSpeed: '10',
    uploadSpeed: '0',
    connections: '1',
    dir: '/downloads',
    files: [],
  }
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mocks.ready.mockReturnValue(true)
  mocks.dialog.mockReturnValue({ destroy: vi.fn() })
  useTaskStore().taskList = [task('a'), task('b'), task('c')]
})
describe('Workspace actions', () => {
  it('exposes creation and batch actions without opening a menu', () => {
    const wrapper = mount(TaskActions)
    expect(wrapper.find('[aria-label="workspace.select-tasks"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="task.new-task"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('replaces the toolbar with selection actions', async () => {
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="workspace.select-tasks"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(useTaskViewStore().selecting).toBe(true)
    expect(wrapper.find('[aria-label="task.new-task"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="task.delete-task"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="workspace.done"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('retains the select-page and done controls as eligible actions change', async () => {
    const view = useTaskViewStore()
    view.selecting = true
    const wrapper = mount(TaskActions)
    const select = wrapper.find('[aria-label="workspace.select-page"]').element
    const done = wrapper.find('[aria-label="workspace.done"]').element
    view.selected = ['a', 'b']
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="task.pause-task"]').exists()).toBe(true)
    view.selected = []
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="task.pause-task"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="workspace.select-page"]').element).toBe(select)
    expect(wrapper.find('[aria-label="workspace.done"]').element).toBe(done)
    wrapper.unmount()
  })
  it('confirms only selected downloads and keeps failed items selected', async () => {
    const tasks = useTaskStore()
    const view = useTaskViewStore()
    view.selecting = true
    view.selected = ['a', 'b']
    tasks.batchRemoveTask = vi.fn().mockResolvedValue({ succeeded: ['a'], failed: [{ gid: 'b', error: 'Busy' }] })
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="task.delete-task"]').trigger('click')
    expect(tasks.batchRemoveTask).not.toHaveBeenCalled()
    await mocks.dialog.mock.calls[0][0].onPositiveClick()
    expect(tasks.batchRemoveTask).toHaveBeenCalledWith(['a', 'b'])
    expect(view.selected).toEqual(['b'])
    expect(mocks.deleteFiles).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith('task.batch-delete-task-partial')
    wrapper.unmount()
  })
  it('blocks destructive commands while the engine is unavailable', async () => {
    mocks.ready.mockReturnValue(false)
    useTaskViewStore().selecting = true
    useTaskViewStore().selected = ['a']
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="task.delete-task"]').trigger('click')
    expect(mocks.dialog).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith('app.engine-not-ready')
    wrapper.unmount()
  })
  it('runs only selected pause operations and preserves failures for review', async () => {
    const tasks = useTaskStore()
    const view = useTaskViewStore()
    view.selecting = true
    view.selected = ['a', 'b']
    tasks.pauseTask = vi.fn().mockImplementation(async (item: Aria2Task) => {
      if (item.gid === 'b') throw new Error('Busy')
    })
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="task.pause-task"]').trigger('click')
    await flushPromises()
    expect(tasks.pauseTask).toHaveBeenCalledTimes(2)
    expect(mocks.error).toHaveBeenCalledWith('workspace.partial-failure')
    expect(view.selecting).toBe(true)
    expect(view.selected).toEqual(['b'])
    wrapper.unmount()
  })
  it('skips selection-required and completed tasks during batch resume', async () => {
    const tasks = useTaskStore()
    const view = useTaskViewStore()
    tasks.taskList = [
      { ...task('a'), status: 'paused' },
      { ...task('b'), status: 'paused', bittorrent: { fileSelectionState: 'awaiting' } as Aria2Task['bittorrent'] },
      { ...task('c'), status: 'complete' },
    ]
    view.selecting = true
    view.selected = ['a', 'b', 'c']
    tasks.resumeTask = vi.fn().mockResolvedValue(true)
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="task.resume-task"]').trigger('click')
    await flushPromises()
    expect(tasks.resumeTask).toHaveBeenCalledTimes(1)
    expect(tasks.resumeTask).toHaveBeenCalledWith(expect.objectContaining({ gid: 'a' }))
    expect(view.selected).toEqual(['b', 'c'])
    wrapper.unmount()
  })
  it('exposes stopping seeding and retains only failed selected seeders', async () => {
    const tasks = useTaskStore()
    const view = useTaskViewStore()
    tasks.taskList = ['a', 'b'].map((gid) => ({
      ...task(gid),
      seeder: 'true',
      bittorrent: { state: 'seeding' } as Aria2Task['bittorrent'],
    }))
    view.selecting = true
    view.selected = ['a', 'b']
    tasks.finishSharingTasks = vi.fn().mockResolvedValue({ succeeded: ['a'], failed: [{ gid: 'b', message: 'Busy' }] })
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="task.finish-seeding"]').trigger('click')
    await mocks.dialog.mock.calls[0][0].onPositiveClick()
    expect(tasks.finishSharingTasks).toHaveBeenCalledWith(['a', 'b'])
    expect(view.selected).toEqual(['b'])
    wrapper.unmount()
  })
  it('offers global controls only in the progress scope and keeps their native scope', async () => {
    const tasks = useTaskStore()
    tasks.taskCounts.progress = 3
    tasks.pauseAllTask = vi.fn().mockResolvedValue(undefined)
    tasks.pauseTask = vi.fn()
    const wrapper = mount(TaskActions)
    expect(wrapper.find('[aria-label="workspace.queue"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="task.sort-by"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="workspace.view"]').exists()).toBe(true)
    tasks.currentList = 'progress'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="workspace.queue"]').exists()).toBe(true)
    const queue = wrapper
      .findAllComponents(NDropdown)
      .find((dropdown) => dropdown.props('options')?.some((option) => option?.key === 'pause'))!
    queue.vm.$emit('select', 'pause')
    await mocks.dialog.mock.calls[0][0].onPositiveClick()
    expect(tasks.pauseAllTask).toHaveBeenCalledOnce()
    expect(tasks.pauseTask).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('leaves selection mode without changing the search or selected task data', async () => {
    const view = useTaskViewStore()
    view.query = 'linux'
    view.selecting = true
    view.selected = ['a']
    const wrapper = mount(TaskActions)
    await wrapper.find('[aria-label="workspace.done"]').trigger('click')
    expect(view.selecting).toBe(false)
    expect(view.selected).toEqual([])
    expect(view.query).toBe('linux')
    expect(useTaskStore().taskList).toHaveLength(3)
    wrapper.unmount()
  })
})
