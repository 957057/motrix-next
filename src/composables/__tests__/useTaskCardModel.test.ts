import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { useTaskCardModel } from '@/composables/useTaskCardModel'
import type { Aria2Task } from '@shared/types'

function makeTask(overrides: Partial<Aria2Task>): Aria2Task {
  return {
    gid: 'task',
    status: 'active',
    totalLength: '100',
    completedLength: '100',
    uploadLength: '50',
    downloadSpeed: '0',
    uploadSpeed: '10',
    connections: '1',
    dir: '/downloads',
    files: [],
    seeder: 'true',
    ...overrides,
  }
}

function renderStatus(task: Aria2Task): string {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        task: {
          seeding: 'Seeding',
          sharing: 'Sharing',
          'seeding-paused': 'Seeding paused',
          'sharing-paused': 'Sharing paused',
        },
      },
    },
  })
  const wrapper = mount(
    defineComponent({
      setup() {
        const model = useTaskCardModel(computed(() => task))
        return () => h('span', model.statusBadge.value?.label ?? '')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return wrapper.text()
}

describe('useTaskCardModel sharing status', () => {
  it('shows the BitTorrent state without its changing duration', () => {
    const text = renderStatus(makeTask({ bittorrent: { state: 'seeding', finishedTime: '125' } }))

    expect(text).toBe('Seeding')
  })

  it('shows the ED2K state without its changing duration', () => {
    const text = renderStatus(makeTask({ ed2k: { sharingTime: '125' } }))

    expect(text).toBe('Sharing')
  })

  it('keeps concise paused states', () => {
    expect(renderStatus(makeTask({ status: 'paused', bittorrent: { state: 'paused', finishedTime: '125' } }))).toBe(
      'Seeding paused',
    )
    expect(renderStatus(makeTask({ status: 'paused', ed2k: { sharingTime: '125' } }))).toBe('Sharing paused')
  })
})
