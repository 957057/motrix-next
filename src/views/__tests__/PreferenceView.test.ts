import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView, type NavigationGuard } from 'vue-router'
import PreferenceView from '../PreferenceView.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ updatesAvailable: false }) }))
vi.mock('@/composables/usePlatform', () => ({ usePlatform: () => ({ platform: ref('win32') }) }))
vi.mock('naive-ui', () => ({
  NSelect: { template: '<input />' },
  NIcon: { template: '<span><slot /></span>' },
}))

const general = defineComponent({ template: '<div class="general-form">General form</div>' })
const downloads = defineComponent({ template: '<div class="downloads-form">Downloads form</div>' })
const network = defineComponent({ template: '<div class="network-form">Network form</div>' })
let frames: FrameRequestCallback[]
let wrappers: VueWrapper[]

function deferredComponent() {
  let resolve!: (component: typeof downloads) => void
  let reject!: (error: Error) => void
  const promise = new Promise<typeof downloads>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { resolve, reject, loader: vi.fn(() => promise) }
}

async function setup(beforeEach?: NavigationGuard) {
  const pending = deferredComponent()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/preference',
        component: PreferenceView,
        children: [
          { path: 'general', component: general },
          { path: 'downloads', component: pending.loader },
          { path: 'network', component: network },
          ...['bt', 'ed2k', 'connections', 'advanced'].map((path) => ({ path, component: network })),
        ],
      },
    ],
  })
  if (beforeEach) router.beforeEach(beforeEach)
  const onError = vi.fn()
  router.onError(onError)
  await router.push('/preference/general')
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router] },
  })
  wrappers.push(wrapper)
  return { router, wrapper, pending, onError }
}

async function paintFeedback() {
  expect(frames).toHaveLength(1)
  frames.shift()!(0)
  await vi.runOnlyPendingTimersAsync()
  await flushPromises()
}

describe('Settings navigation feedback', () => {
  beforeEach(() => {
    frames = []
    wrappers = []
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the selected destination before loading its form and keeps routing semantics truthful', async () => {
    const { router, wrapper, pending } = await setup()
    const navigation = router.push('/preference/downloads')
    await flushPromises()

    expect(wrapper.get('a.is-active').attributes('href')).toBe('/preference/downloads')
    expect(wrapper.get('a[aria-current="page"]').attributes('href')).toBe('/preference/general')
    expect(wrapper.get('.panel-body').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('.panel-body').attributes()).toHaveProperty('inert')
    expect(pending.loader).not.toHaveBeenCalled()

    await paintFeedback()
    expect(pending.loader).toHaveBeenCalledOnce()
    pending.resolve(downloads)
    await navigation
    await flushPromises()

    expect(wrapper.get('a[aria-current="page"]').attributes('href')).toBe('/preference/downloads')
    expect(wrapper.find('.downloads-form').exists()).toBe(true)
    expect(wrapper.get('.panel-body').attributes('aria-busy')).toBe('false')
    expect(wrapper.get('.panel-body').attributes()).not.toHaveProperty('inert')
  })

  it('does not let an obsolete navigation clear the latest destination', async () => {
    const { router, wrapper, pending } = await setup()
    const first = router.push('/preference/downloads')
    await flushPromises()
    await paintFeedback()

    const second = router.push('/preference/network')
    await flushPromises()
    pending.resolve(downloads)
    await first
    await flushPromises()
    expect(wrapper.get('a.is-active').attributes('href')).toBe('/preference/network')
    expect(wrapper.get('.panel-body').attributes('aria-busy')).toBe('true')

    await paintFeedback()
    await second
    expect(router.currentRoute.value.path).toBe('/preference/network')
    expect(wrapper.find('.network-form').exists()).toBe(true)
    expect(wrapper.find('.downloads-form').exists()).toBe(false)
  })

  it('preserves the existing unsaved-change guard', async () => {
    const { router, wrapper, pending } = await setup((to) => to.path !== '/preference/downloads')
    await router.push('/preference/downloads')
    await flushPromises()
    expect(wrapper.get('a.is-active').attributes('href')).toBe('/preference/general')
    expect(wrapper.get('.panel-body').attributes('aria-busy')).toBe('false')
    expect(pending.loader).not.toHaveBeenCalled()
    expect(frames).toHaveLength(0)
  })

  it('cancels pending feedback immediately when the current tab is selected again', async () => {
    const { router, wrapper, pending } = await setup()
    const navigation = router.push('/preference/downloads')
    await flushPromises()
    await paintFeedback()
    await router.push('/preference/general')
    await flushPromises()
    expect(wrapper.get('a.is-active').attributes('href')).toBe('/preference/general')
    expect(wrapper.get('.panel-body').attributes('aria-busy')).toBe('false')
    expect(wrapper.get('.panel-body').attributes()).not.toHaveProperty('inert')

    pending.resolve(downloads)
    await navigation
    expect(router.currentRoute.value.path).toBe('/preference/general')
  })

  it('restores the current destination when loading fails', async () => {
    const { router, wrapper, pending, onError } = await setup()
    const failure = expect(router.push('/preference/downloads')).rejects.toThrow('Unavailable form')
    await flushPromises()
    await paintFeedback()
    pending.reject(new Error('Unavailable form'))
    await failure
    await flushPromises()
    expect(onError).toHaveBeenCalledOnce()
    expect(wrapper.get('a.is-active').attributes('href')).toBe('/preference/general')
    expect(wrapper.get('.panel-body').attributes('aria-busy')).toBe('false')
    expect(wrapper.get('.panel-body').attributes()).not.toHaveProperty('inert')
  })

  it('does not delay an in-page setting link or recreate its form', async () => {
    const { router, wrapper } = await setup()
    const form = wrapper.get('.general-form').element
    await router.push('/preference/general#setting-preferences.theme')
    await flushPromises()
    expect(frames).toHaveLength(0)
    expect(wrapper.get('.general-form').element).toBe(form)
  })
})
