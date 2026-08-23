import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

const progressHandle = {
  update: vi.fn(),
  finish: vi.fn(),
  destroy: vi.fn(),
}
const progressMock = vi.fn(() => progressHandle)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useAppMessage', () => ({
  useAppMessage: () => ({ progress: progressMock }),
}))

import { useEngineNotifications } from '@/composables/useEngineNotifications'
import { useEngineStore, type EngineSnapshot } from '@/stores/engine'

function setSnapshot(patch: Partial<EngineSnapshot>) {
  const store = useEngineStore()
  store.snapshot = {
    ...store.snapshot,
    revision: store.snapshot.revision + 1,
    ...patch,
  }
}

function mountNotifications() {
  return mount(
    defineComponent({
      setup() {
        useEngineNotifications()
        return () => null
      },
    }),
  )
}

describe('engine notifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders one reactive toast across the complete user restart lifecycle', () => {
    mountNotifications()

    setSnapshot({ operationId: 1, cause: 'manualRestart', phase: 'stopping' })
    expect(progressMock).toHaveBeenCalledWith('preferences.engine-restart-stopping')

    setSnapshot({ operationId: 1, cause: 'manualRestart', phase: 'starting' })
    expect(progressHandle.update).toHaveBeenCalledWith('preferences.engine-restarting')

    setSnapshot({ operationId: 1, cause: 'manualRestart', phase: 'running' })
    expect(progressHandle.finish).toHaveBeenCalledWith('preferences.engine-restarted', 'success')
    expect(progressMock).toHaveBeenCalledTimes(1)
  })

  it('ignores background operations and destroys a user toast when cancellation supersedes it', () => {
    mountNotifications()

    setSnapshot({ operationId: 1, cause: 'startup', phase: 'starting' })
    expect(progressMock).not.toHaveBeenCalled()

    setSnapshot({ operationId: 2, cause: 'settingsChange', phase: 'stopping' })
    expect(progressMock).toHaveBeenCalledTimes(1)

    setSnapshot({ operationId: 3, cause: 'userCancelled', phase: 'stopped' })
    expect(progressHandle.destroy).toHaveBeenCalledOnce()
  })

  it('reports deterministic restart failure through the active toast', () => {
    mountNotifications()
    setSnapshot({ operationId: 1, cause: 'manualRestart', phase: 'stopping' })
    setSnapshot({ operationId: 1, cause: 'manualRestart', phase: 'failed' })
    expect(progressHandle.finish).toHaveBeenCalledWith('preferences.engine-restart-failed', 'error')
  })
})
