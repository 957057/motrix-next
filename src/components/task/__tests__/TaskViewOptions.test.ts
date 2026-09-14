import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NRadioGroup, NSelect } from 'naive-ui'
import { useTaskStore } from '@/stores/task'
import { usePreferenceStore } from '@/stores/preference'
import TaskViewOptions from '../TaskViewOptions.vue'

const error = vi.hoisted(() => vi.fn())
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/useAppMessage', () => ({ useAppMessage: () => ({ error }) }))
function mountOptions() {
  return mount(TaskViewOptions, {
    global: { stubs: { Popover: { template: '<div><slot name="trigger" /><slot /></div>' } } },
  })
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})
describe('Task view options', () => {
  it('offers scope-specific fields and forwards explicit sort direction', async () => {
    const tasks = useTaskStore()
    const setSort = vi.spyOn(tasks, 'setCurrentSort').mockResolvedValue(undefined)
    const wrapper = mountOptions()
    const field = wrapper.findAllComponents(NSelect)[0]
    expect(field.props('options')?.some((option) => option.value === 'speed')).toBe(false)
    tasks.currentList = 'progress'
    await wrapper.vm.$nextTick()
    expect(field.props('options')?.some((option) => option.value === 'speed')).toBe(true)
    field.vm.$emit('update:value', 'name')
    await flushPromises()
    expect(setSort).toHaveBeenCalledWith('name', 'desc')
    wrapper.findAllComponents(NSelect)[1].vm.$emit('update:value', 'asc')
    await flushPromises()
    expect(setSort).toHaveBeenLastCalledWith('added-at', 'asc')
    wrapper.unmount()
  })
  it('reports density persistence failures without changing the active mode', async () => {
    const preferences = usePreferenceStore()
    const persist = vi.spyOn(preferences, 'updateAndSave').mockResolvedValue(false)
    const wrapper = mountOptions()
    wrapper.findComponent(NRadioGroup).vm.$emit('update:value', 'compact')
    await flushPromises()
    expect(persist).toHaveBeenCalledWith({ taskCardMode: 'compact' })
    expect(preferences.config.taskCardMode).toBe('full')
    expect(error).toHaveBeenCalledWith('preferences.save-fail-message')
    wrapper.unmount()
  })
})
