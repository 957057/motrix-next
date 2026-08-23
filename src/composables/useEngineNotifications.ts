import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEngineStore, type EngineOperationCause, type EnginePhase } from '@/stores/engine'
import { useAppMessage, type AppProgressMessage } from '@/composables/useAppMessage'

type RestartNotificationStage = 'stopping' | 'restarting' | 'complete' | 'failed'

function isUserRestart(cause: EngineOperationCause): boolean {
  return cause === 'manualRestart' || cause === 'settingsChange'
}

function notificationStage(phase: EnginePhase): RestartNotificationStage | null {
  if (phase === 'stopping') return 'stopping'
  if (['preparing', 'starting', 'probing', 'initializing', 'recovering'].includes(phase)) return 'restarting'
  if (phase === 'running') return 'complete'
  if (phase === 'failed') return 'failed'
  return null
}

export function useEngineNotifications() {
  const { t } = useI18n()
  const engineStore = useEngineStore()
  const message = useAppMessage()
  let activeOperationId: number | null = null
  let activeStage: RestartNotificationStage | null = null
  let progress: AppProgressMessage | null = null

  function clearProgress() {
    progress?.destroy()
    progress = null
    activeOperationId = null
    activeStage = null
  }

  const stopWatching = watch(
    () => engineStore.snapshot,
    (snapshot) => {
      if (!isUserRestart(snapshot.cause)) {
        if (activeOperationId !== null && snapshot.operationId >= activeOperationId) clearProgress()
        return
      }

      const stage = notificationStage(snapshot.phase)
      if (!stage) return

      if (activeOperationId !== snapshot.operationId) {
        clearProgress()
        activeOperationId = snapshot.operationId
        activeStage = null
      }
      if (activeStage === stage) return
      activeStage = stage

      if (!progress) {
        const initialKey =
          stage === 'stopping' ? 'preferences.engine-restart-stopping' : 'preferences.engine-restarting'
        progress = message.progress(t(initialKey))
      }

      if (stage === 'stopping') {
        progress.update(t('preferences.engine-restart-stopping'))
        return
      }
      if (stage === 'restarting') {
        progress.update(t('preferences.engine-restarting'))
        return
      }
      if (stage === 'complete') {
        progress.finish(t('preferences.engine-restarted'), 'success')
        progress = null
        return
      }
      progress.finish(t('preferences.engine-restart-failed'), 'error')
      progress = null
    },
    { flush: 'sync' },
  )

  onUnmounted(() => {
    stopWatching()
    clearProgress()
  })
}
