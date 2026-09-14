import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '@/stores/task'
import { useTaskViewStore } from '@/stores/taskView'
import { usePreferenceStore } from '@/stores/preference'
import TaskList from '../TaskList.vue'
import TaskRow from '../TaskRow.vue'
import type { Aria2Task } from '@shared/types'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(true) }))
function task(gid = 'a'): Aria2Task {
  return {
    gid,
    status: 'active',
    totalLength: '100',
    completedLength: '25',
    uploadLength: '0',
    downloadSpeed: '10',
    uploadSpeed: '0',
    connections: '1',
    dir: '/downloads',
    files: [
      { index: '1', path: '/downloads/ubuntu.iso', length: '100', completedLength: '25', selected: 'true', uris: [] },
    ],
  }
}
beforeEach(() => {
  setActivePinia(createPinia())
  useTaskStore().taskPagination.all.loaded = true
  usePreferenceStore().config.reduceMotion = true
})
describe('Task workspace', () => {
  it('waits for a successful first page before showing an empty state', async () => {
    const tasks = useTaskStore()
    tasks.taskPagination.all.loaded = false
    tasks.listPending = true
    const wrapper = mount(TaskList)
    expect(wrapper.find('.list-empty').exists()).toBe(false)
    expect(wrapper.find('.n-spin').exists()).toBe(false)

    tasks.taskPagination.all.loaded = true
    tasks.listPending = false
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.empty-title').text()).toBe('workspace.empty-tasks')
    expect(wrapper.get('.empty-hint').text()).toBe('workspace.empty-tasks-hint')
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps the confirmed empty state mounted during background updates', async () => {
    const tasks = useTaskStore()
    const wrapper = mount(TaskList)
    const empty = wrapper.get('.list-empty').element
    tasks.listPending = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.list-empty').element).toBe(empty)
    expect(wrapper.find('.n-spin').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps search clearing available without duplicating creation in a filtered view', async () => {
    const tasks = useTaskStore()
    const view = useTaskViewStore()
    tasks.currentList = 'completed'
    tasks.displayedList = 'completed'
    tasks.taskPagination.completed.loaded = true
    view.query = 'missing'
    const wrapper = mount(TaskList)
    expect(wrapper.get('.empty-title').text()).toBe('workspace.no-results')
    await wrapper.get('.list-empty button').trigger('click')
    expect(view.query).toBe('')
    expect(wrapper.get('.empty-title').text()).toBe('workspace.empty-tasks')
    expect(wrapper.find('.empty-hint').exists()).toBe(false)
    expect(wrapper.find('.list-empty button').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows a failed initial query with retry instead of an empty result', async () => {
    const tasks = useTaskStore()
    tasks.taskPagination.all.loaded = false
    tasks.queryError = 'Database unavailable'
    tasks.fetchList = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(TaskList)
    expect(wrapper.find('.list-empty').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Database unavailable')
    await wrapper.get('[role="alert"] button').trigger('click')
    expect(tasks.fetchList).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
  it('keeps the same row and expanded content across density and lifecycle changes', async () => {
    const tasks = useTaskStore()
    tasks.taskList = [task()]
    const wrapper = mount(TaskList)
    const row = wrapper.findComponent(TaskRow).vm.$.uid
    await wrapper.find('.task-name').trigger('click')
    usePreferenceStore().config.taskCardMode = 'compact'
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(TaskRow).vm.$.uid).toBe(row)
    expect(wrapper.find('.task-row.compact').exists()).toBe(true)
    tasks.taskList = [{ ...task(), status: 'complete' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(TaskRow).vm.$.uid).toBe(row)
    expect(useTaskViewStore().expanded).toBe('a')
    wrapper.unmount()
  })
  it('does not paginate a page already selected by SQLite', () => {
    const tasks = useTaskStore()
    tasks.taskPagination.all.page = 4
    tasks.taskList = [task('page-four')]
    const wrapper = mount(TaskList)
    expect(wrapper.findAllComponents(TaskRow)).toHaveLength(1)
    wrapper.unmount()
  })
  it('retains the presence owner when the final task leaves', async () => {
    const tasks = useTaskStore()
    tasks.taskList = [task()]
    const wrapper = mount(TaskList)
    const container = wrapper.find('.task-rows').element
    tasks.taskList = []
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.task-rows').element).toBe(container)
    wrapper.unmount()
  })
  it('opens full details only through an explicit action', async () => {
    useTaskStore().taskList = [task()]
    const wrapper = mount(TaskList)
    await wrapper.find('.task-row').trigger('click')
    expect(wrapper.emitted('show-info')).toBeUndefined()
    wrapper.findComponent(TaskRow).vm.$emit('show-info', task())
    expect(wrapper.emitted('show-info')?.[0][0]).toMatchObject({ gid: 'a' })
    wrapper.unmount()
  })
  it('keeps the last page visible when the query fails', () => {
    useTaskStore().taskList = [task()]
    useTaskStore().queryError = 'Database unavailable'
    const wrapper = mount(TaskList)
    expect(wrapper.find('[role="alert"]').text()).toContain('Database unavailable')
    expect(wrapper.findAllComponents(TaskRow)).toHaveLength(1)
    wrapper.unmount()
  })
  it('shows native sharing and paused states on the same task row', async () => {
    const tasks = useTaskStore()
    const shared = { ...task(), seeder: 'true', bittorrent: { state: 'seeding' } as Aria2Task['bittorrent'] }
    tasks.taskList = [shared]
    const wrapper = mount(TaskList)
    expect(wrapper.find('.row-meta').text()).toContain('task.seeding')
    expect(wrapper.find('.primary-action[aria-label="task.finish-seeding"]').exists()).toBe(true)
    tasks.taskList = [{ ...shared, status: 'paused' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.row-meta').text()).toContain('task.seeding-paused')
    tasks.taskList = [{ ...task(), status: 'paused' }]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.row-meta').text()).toContain('task.status-paused')
    wrapper.unmount()
  })
})
