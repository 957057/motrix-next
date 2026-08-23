import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { logger } from '@shared/logger'

export type EnginePhase =
  | 'stopped'
  | 'preparing'
  | 'starting'
  | 'probing'
  | 'initializing'
  | 'running'
  | 'recovering'
  | 'stopping'
  | 'failed'

export type EngineFailureStage = 'spawn' | 'probe' | 'contract' | 'initialization' | 'runtime' | 'shutdown'

export type EngineOperationCause =
  | 'initial'
  | 'startup'
  | 'manualRestart'
  | 'settingsChange'
  | 'runtimeCrash'
  | 'rpcUnhealthy'
  | 'portConflict'
  | 'updateInstall'
  | 'updateInstallFailed'
  | 'appRelaunch'
  | 'appExit'
  | 'userCancelled'

export interface EngineFailure {
  stage: EngineFailureStage
  message: string
  retryable: boolean
  exitCode: number | null
  signal: number | null
  stderrTail: string[]
}

export interface EngineSnapshot {
  phase: EnginePhase
  desired: 'running' | 'stopped'
  revision: number
  operationId: number
  attempt: number
  maxAttempts: number
  cause: EngineOperationCause
  failure: EngineFailure | null
}

const INITIAL_SNAPSHOT: EngineSnapshot = {
  phase: 'stopped',
  desired: 'stopped',
  revision: 0,
  operationId: 0,
  attempt: 0,
  maxAttempts: 3,
  cause: 'initial',
  failure: null,
}

export const useEngineStore = defineStore('engine', () => {
  const snapshot = ref<EngineSnapshot>({ ...INITIAL_SNAPSHOT })
  const listenerReady = ref(false)
  let unlisten: UnlistenFn | null = null

  const isReady = computed(() => snapshot.value.phase === 'running')
  const isBusy = computed(() =>
    ['preparing', 'starting', 'probing', 'initializing', 'recovering', 'stopping'].includes(snapshot.value.phase),
  )
  const showStatusDialog = computed(
    () =>
      snapshot.value.phase === 'failed' ||
      snapshot.value.phase === 'recovering' ||
      (snapshot.value.cause === 'runtimeCrash' && isBusy.value),
  )

  function applySnapshot(next: EngineSnapshot) {
    if (next.revision < snapshot.value.revision) return
    snapshot.value = next
  }

  async function initialize() {
    if (listenerReady.value) return
    unlisten = await listen<EngineSnapshot>('engine-state-changed', (event) => {
      applySnapshot(event.payload)
    })
    listenerReady.value = true
    applySnapshot(await invoke<EngineSnapshot>('engine_supervisor_state'))
  }

  async function run(command: 'engine_ensure_running' | 'engine_restart' | 'engine_stop', cause: EngineOperationCause) {
    try {
      const next = await invoke<EngineSnapshot>(command, { cause })
      applySnapshot(next)
      return next
    } catch (error) {
      try {
        applySnapshot(await invoke<EngineSnapshot>('engine_supervisor_state'))
      } catch (stateError) {
        logger.error('EngineStore.state', stateError)
      }
      throw error
    }
  }

  function ensureRunning(cause: EngineOperationCause) {
    return run('engine_ensure_running', cause)
  }

  function restart(cause: EngineOperationCause) {
    return run('engine_restart', cause)
  }

  function stop(cause: EngineOperationCause) {
    return run('engine_stop', cause)
  }

  async function cancel() {
    try {
      const next = await invoke<EngineSnapshot>('engine_cancel')
      applySnapshot(next)
      return next
    } catch (error) {
      try {
        applySnapshot(await invoke<EngineSnapshot>('engine_supervisor_state'))
      } catch (stateError) {
        logger.error('EngineStore.cancelState', stateError)
      }
      throw error
    }
  }

  function dispose() {
    unlisten?.()
    unlisten = null
    listenerReady.value = false
  }

  return {
    snapshot,
    isReady,
    isBusy,
    showStatusDialog,
    initialize,
    ensureRunning,
    restart,
    stop,
    cancel,
    dispose,
  }
})
