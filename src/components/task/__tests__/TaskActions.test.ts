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
  it('uses one primary action and two menu triggers', () => {
    const wrapper = mount(TaskActions)
    expect(wrapper.findAll('button')).toHaveLength(3)
    expect(wrapper.find('[aria-label="task.new-task"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('replaces the toolbar with selection actions', async () => {
    const wrapper = mount(TaskActions)
    wrapper.findAllComponents(NDropdown)[1].vm.$emit('select', 'select')
    await wrapper.vm.$nextTick()
    expect(useTaskViewStore().selecting).toBe(true)
    expect(wrapper.find('[aria-label="task.new-task"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="task.delete-task"]').attributes('disabled')).toBeDefined()
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
    wrapper.unmount()
  })
})
