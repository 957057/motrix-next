import { describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { darkTheme, NConfigProvider } from 'naive-ui'
import { buildNaiveTheme } from '@/composables/useColorScheme'
import { buildAppColorTokens, buildColorSchemeTheme } from '@shared/utils/colorScheme'
import { COLOR_SCHEMES } from '@shared/constants'
import BtFileSelector from '../BtFileSelector.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const files = [
  { index: 1, name: 'movie.mp4', path: 'movie.mp4', length: 100 },
  { index: 2, name: 'notes.txt', path: 'notes.txt', length: 20 },
]

describe('Torrent selection with the application theme', () => {
  for (const dark of [false, true]) {
    it(`renders actual table rows and preserves hidden selections (${dark ? 'dark' : 'light'})`, async () => {
      const selected = ref([1, 2])
      const tokens = buildAppColorTokens(buildColorSchemeTheme(COLOR_SCHEMES[0]), dark)
      const wrapper = mount(NConfigProvider, {
        props: { theme: dark ? darkTheme : null, themeOverrides: buildNaiveTheme(tokens) },
        slots: {
          default: () =>
            h(BtFileSelector, {
              files,
              selectedIndices: selected.value,
              'onUpdate:selectedIndices': (indices: number[]) => {
                selected.value = indices
              },
            }),
        },
      })
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
      expect(wrapper.text()).toContain('movie.mp4')
      expect(wrapper.text()).toContain('notes.txt')
      await wrapper.find('input:not([type="checkbox"])').setValue('movie')
      expect(wrapper.findAll('tbody tr')).toHaveLength(1)
      await wrapper.find('tbody [role="checkbox"]').trigger('click')
      expect(selected.value).toEqual([2])
      await wrapper.find('input:not([type="checkbox"])').setValue('missing')
      expect(wrapper.find('.n-empty').exists()).toBe(true)
      expect(selected.value).toEqual([2])
      wrapper.unmount()
    })
  }
})
