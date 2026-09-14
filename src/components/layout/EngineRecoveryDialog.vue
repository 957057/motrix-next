<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCollapseTransition, NIcon, NModal, NSpin } from 'naive-ui'
import { CheckmarkCircleOutline, CloseCircleOutline } from '@vicons/ionicons5'
import { useEngineStore, type EnginePhase } from '@/stores/engine'
import { useAppMessage } from '@/composables/useAppMessage'
import { getErrorMessage } from '@shared/utils/errorMessage'
import { logger } from '@shared/logger'
import TransitionText from '@/components/common/TransitionText.vue'
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
// Keep the last presentation alive until the modal has finished leaving.
const presentation = ref(engineStore.snapshot)
let successTimer: ReturnType<typeof setTimeout> | null = null

const failed = computed(() => presentation.value.phase === 'failed')
const cleaning = computed(() => presentation.value.phase === 'cleaning')
const panelState = computed<PanelState>(() => {
  if (completed.value) return 'complete'
  if (failed.value) return 'failed'
  if (cleaning.value) return 'cleaning'
  return 'recovering'
})
const title = computed(() =>
  presentation.value.cause === 'runtimeCrash' ? t('app.engine-crashed') : t('app.engine-failed'),
)
const attemptText = computed(() => {
  const { attempt, maxAttempts } = presentation.value
  return `${attempt} / ${maxAttempts}`
})
const failureDetail = computed(() => {
  const failure = presentation.value.failure
  if (!failure) return ''
  const stderr = failure.stderrTail.map((line) => line.trim()).filter((line) => line && line !== 'Exception caught')
  return stderr.length > 0 ? stderr[stderr.length - 1] : failure.message
})
const activeStage = computed(() => {
  if (completed.value) return 3
  const phase: EnginePhase = presentation.value.phase
  if (phase === 'starting') return 1
  if (phase === 'probing' || phase === 'initializing' || phase === 'stabilizing') return 2
  return 0
})
const activeStageLabel = computed(() =>
  completed.value
    ? t('preferences.engine-restarted')
    : [t('app.engine-stage-stop'), t('app.engine-stage-start'), t('app.engine-stage-verify')][activeStage.value],
)
const statusTitle = computed(() => {
  if (completed.value)
    return presentation.value.cause === 'sessionRecovery'
      ? t('preferences.reset-engine-state-success')
      : t('preferences.engine-restarted')
  return ['manualRestart', 'settingsChange'].includes(presentation.value.cause)
    ? t('app.engine-restarting')
    : t('app.engine-recovering')
})
const statusDescription = computed(() =>
  completed.value
    ? t('app.engine-recovered-description')
    : presentation.value.attempt > 1
      ? `${t('app.engine-attempt')} ${attemptText.value}`
      : activeStageLabel.value,
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

function dismiss() {
  clearSuccessTimer()
  visible.value = false
}

function afterLeave() {
  if (visible.value) return
  completed.value = false
}

watch(
  () => engineStore.snapshot,
  (snapshot) => {
    if (engineStore.showStatusDialog) {
      clearSuccessTimer()
      presentation.value = snapshot
      completed.value = false
      visible.value = true
      return
    }
    if (snapshot.phase === 'running' && visible.value) {
      if (completed.value && presentation.value.operationId === snapshot.operationId) return
      clearSuccessTimer()
      presentation.value = snapshot
      completed.value = true
      const operationId = snapshot.operationId
      successTimer = setTimeout(() => {
        if (presentation.value.operationId === operationId && completed.value) dismiss()
      }, ENGINE_RECOVERY_SUCCESS_DURATION)
    } else if (snapshot.phase === 'stopped') {
      dismiss()
    }
  },
  { immediate: true, flush: 'sync' },
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
  <NModal
    :show="visible"
    :mask-closable="false"
    :close-on-esc="false"
    transform-origin="center"
    @after-leave="afterLeave"
  >
    <section class="engine-dialog" :data-state="panelState" aria-live="polite">
      <div class="engine-panel-viewport">
        <Transition
          name="view"
          @before-leave="(element) => element.setAttribute('inert', '')"
          @before-enter="(element) => element.removeAttribute('inert')"
          @leave-cancelled="(element) => element.removeAttribute('inert')"
        >
          <div
            :key="panelState === 'complete' ? 'recovering' : panelState"
            class="engine-panel-state"
            :data-panel="panelState"
          >
            <template v-if="panelState === 'recovering' || panelState === 'complete'">
              <div class="engine-heading-row">
                <div class="engine-heading-copy">
                  <h2><TransitionText :text="statusTitle" /></h2>
                  <p class="engine-attempt"><TransitionText :text="statusDescription" /></p>
                </div>
                <span class="engine-heading-icon" aria-hidden="true">
                  <Transition name="engine-status">
                    <NIcon v-if="completed" key="complete" :size="28"><CheckmarkCircleOutline /></NIcon>
                    <NSpin v-else key="loading" :size="28" />
                  </Transition>
                </span>
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

                <NCollapseTransition :show="!!failureDetail && !completed"
                  ><div key="error" class="engine-error-block">
                    <span class="engine-error-label">{{ t('app.engine-last-error') }}</span>
                    <code>{{ failureDetail }}</code>
                  </div></NCollapseTransition
                >
              </div>
            </template>

            <template v-else-if="panelState === 'cleaning'">
              <div class="engine-heading-row">
                <h2 class="engine-heading-copy">{{ t('app.engine-cleaning') }}</h2>
                <span class="engine-heading-icon" aria-hidden="true"><NSpin :size="28" /></span>
              </div>
              <p class="engine-description">{{ t('app.engine-cleaning-description') }}</p>
            </template>

            <template v-else-if="panelState === 'failed'">
              <div class="engine-heading-row engine-heading-row--error">
                <div class="engine-heading-copy">
                  <h2>{{ title }}</h2>
                  <p>{{ t('app.engine-unrecoverable') }}</p>
                  <p class="engine-attempt">{{ t('app.engine-attempt') }} {{ attemptText }}</p>
                </div>
                <span class="engine-heading-icon" aria-hidden="true">
                  <NIcon :size="28"><CloseCircleOutline /></NIcon>
                </span>
              </div>

              <div v-if="failureDetail" class="engine-error-block">
                <span class="engine-error-label">{{ t('app.engine-last-error') }}</span>
                <code>{{ failureDetail }}</code>
              </div>

              <p class="engine-cleanup-warning">{{ t('app.engine-cleanup-warning') }}</p>
            </template>
          </div>
        </Transition>
      </div>

      <footer class="engine-dialog-footer">
        <Transition
          name="fade"
          @before-leave="(element) => element.setAttribute('inert', '')"
          @before-enter="(element) => element.removeAttribute('inert')"
          @leave-cancelled="(element) => element.removeAttribute('inert')"
        >
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

          <div v-else-if="panelState === 'complete'" key="complete" class="engine-footer-state">
            <NButton @click="dismiss">{{ t('app.close') }}</NButton>
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
.engine-attempt {
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
  transition: color 160ms ease;
}
.engine-stage-marker {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
}
.engine-stage-dot,
.engine-stage-check {
  grid-area: 1 / 1;
  transition:
    opacity 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
}
.engine-stage-dot {
  width: 10px;
  height: 10px;
  border: 1px solid var(--m3-outline);
  border-radius: 50%;
}
.engine-stage-check {
  opacity: 0;
}
.engine-recovery-stage[data-state='active'] {
  color: var(--m3-primary);
}
.engine-recovery-stage[data-state='active'] .engine-stage-dot {
  border-color: var(--m3-primary);
  background: var(--m3-primary);
}
.engine-recovery-stage[data-state='complete'] .engine-stage-check {
  opacity: 1;
  color: var(--m3-primary);
}
.engine-recovery-stage[data-state='complete'] .engine-stage-dot {
  opacity: 0;
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
  display: grid;
  min-height: 53px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}
.engine-footer-state {
  grid-area: 1 / 1;
  min-height: 36px;
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
.engine-heading-icon {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  color: var(--m3-primary);
}
.engine-heading-icon > * {
  grid-area: 1 / 1;
}
.engine-status-enter-active,
.engine-status-leave-active {
  transition: opacity 180ms ease;
}
.engine-status-enter-from,
.engine-status-leave-to {
  opacity: 0;
}
.engine-heading-copy {
  flex: 1;
  min-width: 0;
}
.engine-heading-row--error .engine-heading-icon {
  color: inherit;
}
.engine-stage-connector {
  transition: background-color 160ms ease;
}
.engine-stage-connector[data-complete='true'] {
  background: var(--m3-primary);
}
.engine-heading-row--error {
  color: var(--m3-error);
}
</style>
