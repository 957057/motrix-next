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
})
