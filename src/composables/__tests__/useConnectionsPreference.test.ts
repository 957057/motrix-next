import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { usePreferenceStore } from '@/stores/preference'
import { useEngineStore } from '@/stores/engine'
import { useConnectionsPreference } from '../useConnectionsPreference'
import { buildConnectionsForm, buildConnectionsSystemConfig } from '@shared/utils/connectionSettings'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('naive-ui', () => ({ useDialog: () => ({ warning: mocks.confirm }) }))
vi.mock('@/composables/useAppMessage', () => ({ useAppMessage: () => mocks }))
vi.mock('@/api/aria2', () => ({ isEngineReady: () => false, changeGlobalOption: vi.fn() }))

function setup() {
  const preferences = usePreferenceStore()
  const engine = useEngineStore()
  const persist = vi.spyOn(preferences, 'updateAndSave').mockImplementation(async (patch) => {
    Object.assign(preferences.config, patch)
    return true
  })
  vi.spyOn(preferences, 'reloadPreferenceFromDisk').mockResolvedValue(true)
  const restart = vi.spyOn(engine, 'restart').mockImplementation(async () => ({ ...engine.snapshot, phase: 'running' }))
  let form!: ReturnType<typeof useConnectionsPreference>
  const wrapper = mount(
    defineComponent({
      setup() {
        form = useConnectionsPreference()
        return () => null
      },
    }),
  )
  return { preferences, engine, persist, restart, form, wrapper }
}

describe('Connections settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    mocks.confirm.mockImplementation((options) => options.onPositiveClick())
    mocks.invoke.mockImplementation(async (command, args) => (command === 'apply_http_api' ? args.port : undefined))
  })

  it('keeps extension credentials outside the engine configuration', () => {
    const { preferences, wrapper } = setup()
    const form = buildConnectionsForm(preferences.config)
    form.extensionApiSecret = 'extension-only'
    form.rpcSecret = 'rpc-only'
    expect(buildConnectionsSystemConfig(form)).toEqual({
      'rpc-listen-port': String(form.rpcListenPort),
      'rpc-secret': 'rpc-only',
      'allow-remote-access': String(form.allowRemoteAccess),
    })
    wrapper.unmount()
  })

  it('applies extension behavior without restarting the download engine', async () => {
    const { form, restart, wrapper } = setup()
    form.form.value.autoSubmitFromExtension = !form.form.value.autoSubmitFromExtension
    await form.handleSave()
    expect(restart).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.invoke).toHaveBeenCalledWith('apply_http_api', { port: form.form.value.extensionApiPort })
    expect(form.isDirty.value).toBe(false)
    wrapper.unmount()
  })

  it('coalesces saves and waits for a combined engine and extension apply', async () => {
    const { form, restart, preferences, engine, wrapper } = setup()
    let finish!: () => void
    restart.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ...engine.snapshot, phase: 'running' })
        }),
    )
    form.form.value.rpcListenPort += 1
    form.form.value.extensionApiPort += 1
    const saving = form.handleSave()
    expect(form.handleSave()).toBe(saving)
    await flushPromises()
    expect(restart).toHaveBeenCalledTimes(1)
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(form.isSaving.value).toBe(true)
    expect(preferences.savingChanges).toBe(true)
    expect(mocks.success).not.toHaveBeenCalled()
    form.handleReset()
    expect(form.isDirty.value).toBe(true)
    finish()
    await saving
    expect(mocks.invoke.mock.calls.filter(([command]) => command === 'apply_http_api')).toHaveLength(1)
    expect(form.isSaving.value).toBe(false)
    expect(preferences.savingChanges).toBe(false)
    wrapper.unmount()
  })

  it('cancels the entire combined change before persistence', async () => {
    const { form, persist, restart, wrapper } = setup()
    mocks.confirm.mockImplementationOnce((options) => options.onNegativeClick())
    form.form.value.rpcListenPort += 1
    form.form.value.extensionApiPort += 1
    await form.handleSave()
    expect(persist).not.toHaveBeenCalled()
    expect(restart).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(form.isDirty.value).toBe(true)
    expect(form.isSaving.value).toBe(false)
    wrapper.unmount()
  })

  it('restores configuration before retrying the previous runtime binding', async () => {
    const { form, preferences, restart, engine, wrapper } = setup()
    const previous = preferences.config.rpcListenPort
    form.form.value.rpcListenPort = previous + 1
    restart.mockRejectedValueOnce(new Error('Restart failed'))
    restart.mockImplementationOnce(async () => {
      expect(preferences.config.rpcListenPort).toBe(previous)
      return { ...engine.snapshot, phase: 'running' }
    })
    await expect(form.handleSave()).rejects.toThrow('Restart failed')
    expect(restart).toHaveBeenCalledTimes(2)
    expect(form.form.value.rpcListenPort).toBe(previous + 1)
    expect(form.isDirty.value).toBe(true)
    expect(mocks.error).toHaveBeenCalledWith('preferences.connections-restored')
    expect(mocks.success).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reports a failed runtime rollback without claiming restoration', async () => {
    const { form, restart, wrapper } = setup()
    form.form.value.allowRemoteAccess = !form.form.value.allowRemoteAccess
    restart.mockRejectedValue(new Error('Engine unavailable'))
    await expect(form.handleSave()).rejects.toThrow('Engine unavailable')
    expect(mocks.error).toHaveBeenCalledWith('preferences.connections-restore-failed')
    expect(form.isDirty.value).toBe(true)
    wrapper.unmount()
  })

  it('shows the actual extension port selected by native conflict recovery', async () => {
    const { form, preferences, wrapper } = setup()
    const recoveredPort = 29222
    form.form.value.extensionApiPort += 1
    mocks.invoke.mockImplementation(async (command) => (command === 'apply_http_api' ? recoveredPort : undefined))
    await form.handleSave()
    expect(preferences.config.extensionApiPort).toBe(recoveredPort)
    expect(form.form.value.extensionApiPort).toBe(recoveredPort)
    expect(form.isDirty.value).toBe(false)
    wrapper.unmount()
  })

  it('warns before clearing extension authentication without restarting RPC', async () => {
    const { form, restart, wrapper } = setup()
    form.form.value.extensionApiSecret = ''
    await form.handleSave()
    expect(mocks.confirm.mock.calls[0][0].content).toContain('preferences.connection-auth-disabled')
    expect(restart).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
