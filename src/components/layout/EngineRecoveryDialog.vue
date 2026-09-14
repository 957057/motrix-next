<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NModal, NSpin } from 'naive-ui'
import { CheckmarkCircleOutline, CheckmarkOutline, CloseCircleOutline } from '@vicons/ionicons5'
import { useEngineStore, type EnginePhase } from '@/stores/engine'
import { useAppMessage } from '@/composables/useAppMessage'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { logger } from '@shared/logger'
import { ENGINE_RECOVERY_SUCCESS_DURATION } from '@shared/timing'

type PanelState = 'recovering' | 'cleaning' | 'failed' | 'complete'
type RecoveryStageState = 'complete' | 'active' | 'pending'

interface RecoveryStage {
  label: string
  state: RecoveryStageState
}

const { t } = useI18n()
const engineStore = useEngineStore()
const message = useAppMessage()
const pendingAction = ref<'cancel' | 'retry' | 'cleanup' | null>(null)
const visible = ref(false)
const completed = ref(false)
let successTimer: ReturnType<typeof setTimeout> | null = null

const failed = computed(() => engineStore.snapshot.phase === 'failed')
const cleaning = computed(() => engineStore.snapshot.phase === 'cleaning')
const panelState = computed<PanelState>(() => {
  if (completed.value) return 'complete'
  if (failed.value) return 'failed'
  if (cleaning.value) return 'cleaning'
  return 'recovering'
})
const title = computed(() =>
  engineStore.snapshot.cause === 'runtimeCrash' ? t('app.engine-crashed') : t('app.engine-failed'),
)
const attemptText = computed(() => {
  const { attempt, maxAttempts } = engineStore.snapshot
  return `${attempt} / ${maxAttempts}`
})
const failureDetail = computed(() => {
  const failure = engineStore.snapshot.failure
  if (!failure) return ''
  const stderr = failure.stderrTail.map((line) => line.trim()).filter((line) => line && line !== 'Exception caught')
  return stderr.length > 0 ? stderr[stderr.length - 1] : failure.message
})
const activeStage = computed(() => {
  const phase: EnginePhase = engineStore.snapshot.phase
  if (phase === 'starting') return 1
  if (phase === 'probing' || phase === 'initializing' || phase === 'stabilizing') return 2
  return 0
})
const activeStageLabel = computed(
  () => [t('app.engine-stage-stop'), t('app.engine-stage-start'), t('app.engine-stage-verify')][activeStage.value],
)
const recoveryStages = computed<RecoveryStage[]>(() =>
  [t('app.engine-stage-stop'), t('app.engine-stage-start'), t('app.engine-stage-verify')].map((label, index) => ({
    label,
    state: index < activeStage.value ? 'complete' : index === activeStage.value ? 'active' : 'pending',
  })),
)

function clearSuccessTimer() {
  if (successTimer === null) return
  clearTimeout(successTimer)
  successTimer = null
}

function scheduleSuccessDismissal() {
  clearSuccessTimer()
  void nextTick(() => {
    if (!visible.value || !completed.value) return
    successTimer = setTimeout(() => {
      visible.value = false
      completed.value = false
      successTimer = null
    }, ENGINE_RECOVERY_SUCCESS_DURATION)
  })
}

watch(
  () => engineStore.showStatusDialog,
  (show) => {
    if (show) {
      clearSuccessTimer()
      visible.value = true
      completed.value = false
    }
  },
  { immediate: true, flush: 'sync' },
)

watch(
  () => engineStore.snapshot.phase,
  (phase) => {
    if (phase === 'running' && visible.value) {
      completed.value = true
      scheduleSuccessDismissal()
      return
    }
    if (phase === 'stopped') {
      clearSuccessTimer()
      visible.value = false
      completed.value = false
    }
  },
  { flush: 'sync' },
)

onBeforeUnmount(clearSuccessTimer)

async function cancel() {
  if (pendingAction.value) return
  pendingAction.value = 'cancel'
  try {
    await engineStore.cancel()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    pendingAction.value = null
  }
}

async function retry() {
  if (pendingAction.value) return
  pendingAction.value = 'retry'
  try {
    await engineStore.ensureRunning('failureRetry')
  } catch (error) {
    logger.warn('EngineRecovery.retry', getErrorMessage(error))
  } finally {
    pendingAction.value = null
  }
}

async function cleanupAndRetry() {
  if (pendingAction.value) return
  pendingAction.value = 'cleanup'
  try {
    await engineStore.recoverRuntimeState()
  } catch (error) {
    logger.warn('EngineRecovery.cleanup', getErrorMessage(error))
  } finally {
    pendingAction.value = null
  }
}
</script>

<template>
  <NModal :show="visible" :mask-closable="false" :close-on-esc="false" transform-origin="center">
    <section class="engine-dialog" :data-state="panelState" aria-live="polite">
      <div class="engine-panel-viewport">
        <Transition name="view">
          <div :key="panelState" class="engine-panel-state" :data-panel="panelState">
            <template v-if="panelState === 'recovering'">
              <div class="engine-heading-row">
                <NSpin size="small" />
                <div>
                  <h2>{{ t('app.engine-recovering') }}</h2>
                  <p class="engine-attempt">{{ t('app.engine-attempt') }} {{ attemptText }}</p>
                </div>
              </div>

              <div class="engine-recovery-body">
                <div key="stages" class="engine-stage-track" role="list" :aria-label="activeStageLabel">
                  <template v-for="(stage, index) in recoveryStages" :key="stage.label">
                    <div
                      class="engine-recovery-stage"
                      :data-state="stage.state"
                      role="listitem"
                      :aria-current="stage.state === 'active' ? 'step' : undefined"
                    >
                      <span class="engine-stage-marker">
                        <span class="engine-stage-dot" />
                        <NIcon class="engine-stage-check" :size="22">
                          <CheckmarkCircleOutline />
                        </NIcon>
                      </span>
                      <span class="engine-stage-label">{{ stage.label }}</span>
                    </div>
                    <span
                      v-if="index < recoveryStages.length - 1"
                      class="engine-stage-connector"
                      :data-complete="index < activeStage"
                      aria-hidden="true"
                    />
                  </template>
                </div>

                <div v-if="failureDetail" key="error" class="engine-error-block">
                  <span class="engine-error-label">{{ t('app.engine-last-error') }}</span>
                  <code>{{ failureDetail }}</code>
                </div>
              </div>
            </template>

            <template v-else-if="panelState === 'cleaning'">
              <div class="engine-heading-row">
                <NSpin size="small" />
                <h2>{{ t('app.engine-cleaning') }}</h2>
              </div>
              <p class="engine-description">{{ t('app.engine-cleaning-description') }}</p>
            </template>

            <template v-else-if="panelState === 'failed'">
              <div class="engine-heading-row engine-heading-row--error">
                <NIcon :size="24"><CloseCircleOutline /></NIcon>
                <div>
                  <h2>{{ title }}</h2>
                  <p>{{ t('app.engine-unrecoverable') }}</p>
                  <p class="engine-attempt">{{ t('app.engine-attempt') }} {{ attemptText }}</p>
                </div>
              </div>

              <div v-if="failureDetail" class="engine-error-block">
                <span class="engine-error-label">{{ t('app.engine-last-error') }}</span>
                <code>{{ failureDetail }}</code>
              </div>

              <p class="engine-cleanup-warning">{{ t('app.engine-cleanup-warning') }}</p>
            </template>

            <template v-else>
              <div class="engine-complete">
                <div class="engine-success-mark" aria-hidden="true">
                  <NIcon :size="38"><CheckmarkOutline /></NIcon>
                </div>
                <div class="engine-complete-copy">
                  <h2>{{ t('preferences.engine-restarted') }}</h2>
                  <p>{{ t('app.engine-recovered-description') }}</p>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>

      <footer class="engine-dialog-footer">
        <Transition name="fade">
          <div v-if="panelState === 'recovering'" key="recovering" class="engine-footer-state">
            <NButton :loading="pendingAction === 'cancel'" :disabled="pendingAction !== null" @click="cancel">
              {{ t('app.cancel') }}
            </NButton>
          </div>

          <div v-else-if="panelState === 'failed'" key="failed" class="engine-footer-state engine-footer-state--failed">
            <NButton :loading="pendingAction === 'cancel'" :disabled="pendingAction !== null" @click="cancel">
              {{ t('app.cancel') }}
            </NButton>
            <div class="engine-dialog-actions">
              <NButton :loading="pendingAction === 'retry'" :disabled="pendingAction !== null" @click="retry">
                {{ t('app.engine-manual-retry') }}
              </NButton>
              <NButton
                type="primary"
                :loading="pendingAction === 'cleanup'"
                :disabled="pendingAction !== null"
                @click="cleanupAndRetry"
              >
                {{ t('app.engine-reset-state') }}
              </NButton>
            </div>
          </div>

          <div v-else :key="panelState" class="engine-footer-state" />
        </Transition>
      </footer>
    </section>
  </NModal>
</template>

<style scoped>
.engine-dialog {
  width: min(440px, calc(100vw - 48px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
  padding: 24px;
  border-radius: 12px;
  background: var(--main-bg);
  box-shadow: 0 12px 40px var(--m3-shadow);
}
.engine-panel-viewport {
  position: relative;
  min-height: 160px;
}
.engine-heading-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
h2 {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}
.engine-heading-row p,
.engine-description,
.engine-attempt,
.engine-complete-copy p {
  color: var(--m3-on-surface-variant);
  font-size: 13px;
  line-height: 20px;
  margin-top: 8px;
}
.engine-stage-track {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 24px 0;
}
.engine-recovery-stage {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--m3-on-surface-variant);
}
.engine-stage-marker {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
}
.engine-stage-dot {
  width: 10px;
  height: 10px;
  border: 1px solid var(--m3-outline);
  border-radius: 50%;
}
.engine-stage-check {
  display: none;
}
.engine-recovery-stage[data-state='active'] {
  color: var(--m3-primary);
}
.engine-recovery-stage[data-state='active'] .engine-stage-dot {
  border-color: var(--m3-primary);
  background: var(--m3-primary);
}
.engine-recovery-stage[data-state='complete'] .engine-stage-check {
  display: block;
  color: var(--m3-primary);
}
.engine-recovery-stage[data-state='complete'] .engine-stage-dot {
  display: none;
}
.engine-stage-connector {
  flex: 1;
  min-width: 12px;
  height: 1px;
  background: var(--divider);
}
.engine-error-block {
  margin-block: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.engine-error-block code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--m3-error);
}
.engine-cleanup-warning {
  margin-block: 16px;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-line;
}
.engine-dialog-footer {
  position: relative;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}
.engine-footer-state,
.engine-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.engine-footer-state--failed {
  justify-content: space-between;
}
.engine-complete {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-block: 32px;
}
.engine-success-mark {
  color: var(--m3-primary);
}
.engine-heading-row--error {
  color: var(--m3-error);
}
</style>
