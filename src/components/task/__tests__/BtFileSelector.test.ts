import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BtFileSelector from '../BtFileSelector.vue'
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('Filtered torrent selection', () => {
  it('retains selected files outside the current filter', async () => {
    const wrapper = mount(BtFileSelector, {
      props: {
        files: [
          { index: 1, name: 'movie.mp4', path: 'movie.mp4', length: 100 },
          { index: 2, name: 'notes.txt', path: 'notes.txt', length: 20 },
        ],
        selectedIndices: [1, 2],
      },
      global: {
        stubs: {
          DataTable: { name: 'DataTable', props: ['data'], emits: ['update:checkedRowKeys'], template: '<div />' },
        },
      },
    })
    await wrapper.find('input').setValue('movie')
    const table = wrapper.findComponent({ name: 'DataTable' })
    expect(table.props('data')).toHaveLength(1)
    table.vm.$emit('update:checkedRowKeys', [])
    const selections = wrapper.emitted('update:selectedIndices') ?? []
    expect(selections[selections.length - 1]).toEqual([[2]])
    wrapper.unmount()
  })
})
