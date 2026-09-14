import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { usePreferenceStore } from '@/stores/preference'
import General from '../General.vue'

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/useAppMessage', () => ({ useAppMessage: () => messages }))
vi.mock('tauri-plugin-locale-api', () => ({ getLocale: async () => 'en-US' }))
vi.mock('@/composables/useLocale', () => ({ loadLocale: vi.fn() }))
vi.mock('naive-ui', async (original) => ({ ...(await original<object>()), useDialog: () => ({ info: vi.fn() }) }))

async function setup(saved: boolean) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const preferences = usePreferenceStore()
  preferences.config.theme = 'auto'
  const save = vi.spyOn(preferences, 'updateAndSave').mockImplementation(async (patch) => {
    if (saved) Object.assign(preferences.config, patch)
    return saved
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/preference/general', component: General }],
  })
  await router.push('/preference/general')
  const wrapper = mount(General, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, preferences, save }
}

describe('Immediate appearance settings', () => {
  beforeEach(() => vi.clearAllMocks())
  it('applies appearance without saving unrelated window preferences', async () => {
    const { wrapper, preferences, save } = await setup(true)
    const previous = preferences.config.keepWindowState
    wrapper
      .find('[id="setting-preferences.keep-window-state"]')
      .findComponent({ name: 'Switch' })
      .vm.$emit('update:value', !previous)
    wrapper
      .find('[id="setting-preferences.appearance"]')
      .findComponent({ name: 'RadioGroup' })
      .vm.$emit('update:value', 'dark')
    await flushPromises()
    expect(save).toHaveBeenCalledWith({ theme: 'dark' })
    expect(preferences.config.keepWindowState).toBe(previous)
    expect(preferences.pendingChanges).toBe(true)
    expect(preferences.savingChanges).toBe(false)
    wrapper.unmount()
  })
  it('restores the control when persistence fails', async () => {
    const { wrapper, preferences } = await setup(false)
    const theme = wrapper.find('[id="setting-preferences.appearance"]').findComponent({ name: 'RadioGroup' })
    theme.vm.$emit('update:value', 'dark')
    await flushPromises()
    expect(theme.props('value')).toBe('auto')
    expect(preferences.config.theme).toBe('auto')
    expect(preferences.pendingChanges).toBe(false)
    expect(messages.error).toHaveBeenCalledWith('preferences.save-fail-message')
    wrapper.unmount()
  })
})
