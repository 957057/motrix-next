import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import AppSidebar from '../AppSidebar.vue'
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
describe('Workspace navigation', () => {
  it('keeps the logo and settings reachable without a separate connection entry', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/task/all')
    const wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } })
    expect(wrapper.find('a[aria-label="Rayburst"] img').exists()).toBe(true)
    expect(wrapper.find('a[href="/preference/general"]').attributes('title')).toBe('app.preferences')
    expect(wrapper.find('a[href="/connection"]').exists()).toBe(false)
    expect(wrapper.find('a[aria-current="page"]').attributes('href')).toBe('/task/all')
    wrapper.unmount()
  })
})
