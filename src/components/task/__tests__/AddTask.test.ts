import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { DEFAULT_APP_CONFIG } from '@shared/constants'
import { createBatchItem } from '@shared/utils/batchHelpers'
import type { BatchItem } from '@shared/types'
import AddTask from '../AddTask.vue'
import AdvancedOptions from '../addtask/AdvancedOptions.vue'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  clipboard: vi.fn(),
  message: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: ref('en-US') }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => app }))
vi.mock('@/stores/preference', () => ({ usePreferenceStore: () => preferences }))
vi.mock('@/stores/task', () => ({ useTaskStore: () => ({}) }))
vi.mock('@/stores/httpAuth', () => ({ useHttpAuthStore: () => ({}) }))
vi.mock('@/composables/useAppMessage', () => ({ useAppMessage: () => mocks.message }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readText: mocks.clipboard }))
vi.mock('@/composables/useAddTaskFileOps', () => ({
  resolveUnresolvedItems: mocks.resolve,
  resolveTorrentItem: vi.fn(),
  chooseTorrentFile: vi.fn(),
}))

function createAppState() {
  return reactive({
    pendingBatch: [] as BatchItem[],
    pendingReferer: '',
    pendingCookie: '',
    pendingUserAgent: '',
    pendingRequestHeaders: [],
  })
}
let app: ReturnType<typeof createAppState>
let preferences: { config: typeof DEFAULT_APP_CONFIG }
let wrappers: VueWrapper[]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { resolve, promise }
}

function setup() {
  const wrapper = mount(AddTask, {
    props: { show: false },
    global: {
      stubs: {
        AppDialog: { props: ['show'], template: '<section v-show="show"><slot /><slot name="footer" /></section>' },
        DirectoryPopover: true,
        UserAgentPopover: true,
        transition: false,
        'transition-group': false,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

function activeSource(wrapper: VueWrapper) {
  return wrapper.get('.n-tabs-tab--active').attributes('data-name')
}

describe('AddTask source switching', () => {
  beforeEach(() => {
    app = createAppState()
    preferences = reactive({ config: { ...structuredClone(DEFAULT_APP_CONFIG), dir: '/downloads' } })
    wrappers = []
    mocks.resolve.mockReset().mockResolvedValue(undefined)
    mocks.clipboard.mockReset().mockResolvedValue('')
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
  })

  it('selects incoming torrents immediately and never steals a manual tab change after inspection', async () => {
    const inspection = deferred<void>()
    mocks.resolve.mockReturnValue(inspection.promise)
    app.pendingBatch = [createBatchItem('torrent', 'https://example.test/release.torrent')]
    const wrapper = setup()
    await wrapper.setProps({ show: true })
    expect(activeSource(wrapper)).toBe('torrent')

    await wrapper.get('[data-name="uri"]').trigger('click')
    expect(activeSource(wrapper)).toBe('uri')
    inspection.resolve()
    await flushPromises()
    expect(activeSource(wrapper)).toBe('uri')
  })

  it('retains inputs and advanced disclosure instances through rapid native tab transitions', async () => {
    const wrapper = setup()
    await wrapper.setProps({ show: true })
    const sourceInput = wrapper.get('textarea').element
    await wrapper.get('textarea').setValue('https://example.test/file.zip')
    const advanced = wrapper.getComponent(AdvancedOptions)
    await advanced.get('.n-collapse-item__header-main').trigger('click')
    expect(advanced.props('show')).toBe(true)
    const advancedElement = advanced.element
    const panes = wrapper.findAll('.n-tab-pane').map((pane) => pane.element)

    for (const destination of ['torrent', 'uri', 'torrent', 'uri']) {
      await wrapper.get(`[data-name="${destination}"]`).trigger('click')
      expect(activeSource(wrapper)).toBe(destination)
      expect(wrapper.getComponent(AdvancedOptions).element).toBe(advancedElement)
      expect(wrapper.getComponent(AdvancedOptions).props('show')).toBe(true)
      expect(wrapper.findAll('.n-tab-pane').map((pane) => pane.element)).toEqual(panes)
    }
    expect(wrapper.get('textarea').element).toBe(sourceInput)
    expect((sourceInput as HTMLTextAreaElement).value).toBe('https://example.test/file.zip')
    expect(wrapper.find('.task-source-panes').exists()).toBe(true)
    expect(wrapper.get('.task-advanced').attributes()).not.toHaveProperty('inert')
    await vi.waitFor(() => {
      const container = wrapper.get('.task-source-panes').element as HTMLElement
      expect(container.style.height).toBe('')
      expect(container.style.maxHeight).toBe('')
    })
  })

  it('uses the same direction for manual and external source changes', async () => {
    const wrapper = setup()
    await wrapper.setProps({ show: true })
    await wrapper.get('[data-name="torrent"]').trigger('click')
    await wrapper.get('[data-name="uri"]').trigger('click')
    const panes = wrapper.get('.task-source-panes').element as HTMLElement
    expect(panes.style.getPropertyValue('--task-source-direction')).toBe('-1')

    app.pendingBatch = [createBatchItem('torrent', 'C:\\Downloads\\release.torrent')]
    await flushPromises()
    expect(activeSource(wrapper)).toBe('torrent')
    expect(panes.style.getPropertyValue('--task-source-direction')).toBe('1')
    expect(wrapper.get('.task-advanced').attributes()).toHaveProperty('inert')
    expect(wrapper.findAll('.n-tab-pane')[0].attributes()).toHaveProperty('inert')
  })

  it('does not insert late clipboard content after a torrent arrives', async () => {
    const clipboard = deferred<string>()
    mocks.clipboard.mockReturnValue(clipboard.promise)
    const wrapper = setup()
    await wrapper.setProps({ show: true })
    await flushPromises()
    app.pendingBatch = [createBatchItem('torrent', 'C:\\Downloads\\release.torrent')]
    await flushPromises()
    clipboard.resolve('https://example.test/unrelated.zip')
    await flushPromises()
    expect(activeSource(wrapper)).toBe('torrent')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })
})
