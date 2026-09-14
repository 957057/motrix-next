<script setup lang="ts">
import { useRoute } from 'vue-router'
import SettingsRow from './SettingsRow.vue'
/** @fileoverview Downloads preference tab: paths, concurrency, speed limits, notifications, cleanup. */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferenceStore } from '@/stores/preference'
import { usePreferenceForm } from '@/composables/usePreferenceForm'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { extractSpeedUnit } from '@shared/utils'
import { logger } from '@shared/logger'
import { resolveUserVisibleDownloadDir } from '@shared/utils/userVisibleDirectory'
import { toggleSpeedLimit } from '@/composables/useSpeedLimiter'
import { changeGlobalOption, isEngineReady } from '@/api/aria2'
import { SCHEDULE_DAY } from '@shared/constants'
import { useAppMessage } from '@/composables/useAppMessage'
import {
  buildDownloadsForm,
  buildDownloadsSystemConfig,
  getCompletedRecordRetentionSelectValue,
  recordDownloadsDirectory,
  resolveCompletedRecordRetentionDays,
  transformDownloadsForStore,
} from '@/composables/useDownloadsPreference'
import {
  NForm,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NCheckbox,
  NButton,
  NInputGroup,
  NText,
  NCollapseTransition,
  NIcon,
  NRadioButton,
  NRadioGroup,
} from 'naive-ui'
import PreferenceActionBar from './PreferenceActionBar.vue'
import PreferenceCheckboxGrid from './PreferenceCheckboxGrid.vue'
import PreferenceHintLabel from './PreferenceHintLabel.vue'
import DirectoryPopover from '@/components/common/DirectoryPopover.vue'
import FileCategoryManager from './FileCategoryManager.vue'
import { FolderOpenOutline } from '@vicons/ionicons5'

const settingsRoute = useRoute()
const { t } = useI18n()
const preferenceStore = usePreferenceStore()
const message = useAppMessage()
const { constraint, configFieldProps, fieldProps, areConfigFieldsValid } = usePreferenceNumericValidation()
const defaultDownloadDir = ref('')

// ── File timestamp strategy ─────────────────────────────────────────
const FILE_TS_DOWNLOAD = 'download'
const FILE_TS_SERVER = 'server'
const fileTimestampOptions = computed(() => [
  { label: t('preferences.file-timestamp-download'), value: FILE_TS_DOWNLOAD },
  { label: t('preferences.file-timestamp-server'), value: FILE_TS_SERVER },
])
const fileTimestampValue = computed(() => (form.value.remoteTime ? FILE_TS_SERVER : FILE_TS_DOWNLOAD))
function handleFileTimestampChange(val: string) {
  form.value.remoteTime = val === FILE_TS_SERVER
}

const fileDeletionModeOptions = computed(() => [
  { label: t('preferences.file-deletion-mode-trash'), value: 'trash' },
  { label: t('preferences.file-deletion-mode-permanent'), value: 'permanent' },
])

const skipConfirmationFileLabel = computed(() =>
  t(
    form.value.fileDeletionMode === 'permanent'
      ? 'preferences.delete-files-when-skip-confirm-permanent'
      : 'preferences.delete-files-when-skip-confirm-trash',
  ),
)

function buildForm() {
  return buildDownloadsForm(preferenceStore.config, defaultDownloadDir.value)
}

const { form, isDirty, handleSave, handleReset, resetSnapshot, patchSnapshot } = usePreferenceForm({
  buildForm,
  buildSystemConfig: buildDownloadsSystemConfig,
  transformForStore: transformDownloadsForStore,
  afterSave: (f) => {
    recordDownloadsDirectory(f, preferenceStore.recordHistoryDirectory)
  },
})

// ── Speed limit ─────────────────────────────────────────────────────
const uploadSpeedValue = ref(0)
const uploadUnit = ref('K')
const downloadSpeedValue = ref(0)
const downloadUnit = ref('K')
const speedUnitOptions = [
  { label: 'KB/s', value: 'K' },
  { label: 'MB/s', value: 'M' },
]

const timeOptions = (() => {
  const opts: Array<{ label: string; value: string }> = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      opts.push({ label: `${hh}:${mm}`, value: `${hh}:${mm}` })
    }
  }
  return opts
})()

const scheduleDayOptions = computed(() => [
  { label: t('preferences.schedule-days-everyday'), value: SCHEDULE_DAY.EVERY_DAY },
  { label: t('preferences.schedule-days-weekdays'), value: SCHEDULE_DAY.WEEKDAYS },
  { label: t('preferences.schedule-days-weekends'), value: SCHEDULE_DAY.WEEKENDS },
])

const notificationTypeOptions = computed(() => [
  { label: t('preferences.notify-on-start'), value: 'start' },
  { label: t('preferences.notify-on-complete'), value: 'complete' },
])
const completedRecordRetentionOptions = computed(() => [
  { label: t('preferences.completed-record-retention-forever'), value: 0 },
  { label: t('preferences.completed-record-retention-1-day'), value: 1 },
  { label: t('preferences.completed-record-retention-1-week'), value: 7 },
  { label: t('preferences.completed-record-retention-6-months'), value: 180 },
  { label: t('preferences.completed-record-retention-1-year'), value: 365 },
  { label: t('preferences.completed-record-retention-custom'), value: -1 },
])
const completedRecordRetentionMode = ref(0)
const completedRecordRetentionSelectValue = computed<number>({
  get: () => completedRecordRetentionMode.value,
  set: (value) => {
    completedRecordRetentionMode.value = value
    form.value.completedRecordRetentionDays = resolveCompletedRecordRetentionDays(
      value,
      Number(form.value.completedRecordRetentionDays),
    )
  },
})
const selectedNotificationTypes = computed<string[]>({
  get: () => [...(form.value.notifyOnStart ? ['start'] : []), ...(form.value.notifyOnComplete ? ['complete'] : [])],
  set: (types) => {
    const selected = new Set(types)
    form.value.notifyOnStart = selected.has('start')
    form.value.notifyOnComplete = selected.has('complete')
  },
})
const numericFieldsValid = computed(
  () =>
    areConfigFieldsValid({
      maxConcurrentDownloads: form.value.maxConcurrentDownloads,
      streamMaxConnections: form.value.streamMaxConnections,
      maxTries: form.value.maxTries,
      retryWait: form.value.retryWait,
      shareRatio: form.value.shareRatio,
      shareTime: form.value.shareTime,
      completedRecordRetentionDays: form.value.completedRecordRetentionDays,
    }) &&
    (completedRecordRetentionSelectValue.value !== -1 ||
      !fieldProps(form.value.completedRecordRetentionDays, { min: 1, max: 3650, integer: true }).validationStatus),
)

function parseSpeedLimit(value: unknown) {
  const str = String(value || '0')
  const num = parseInt(str, 10) || 0
  const unit = extractSpeedUnit(str) || 'K'
  return { num, unit }
}

function buildSpeedLimit(value: number, unit: string): string {
  return value > 0 ? `${value}${unit}` : '0'
}

function handleUploadUnitChange(val: string) {
  uploadUnit.value = val
  form.value.maxOverallUploadLimit = buildSpeedLimit(uploadSpeedValue.value, val)
}
function handleDownloadUnitChange(val: string) {
  downloadUnit.value = val
  form.value.maxOverallDownloadLimit = buildSpeedLimit(downloadSpeedValue.value, val)
}
function handleUploadValueChange(val: number | null) {
  const v = val || 0
  uploadSpeedValue.value = v
  form.value.maxOverallUploadLimit = buildSpeedLimit(v, uploadUnit.value)
}
function handleDownloadValueChange(val: number | null) {
  const v = val || 0
  downloadSpeedValue.value = v
  form.value.maxOverallDownloadLimit = buildSpeedLimit(v, downloadUnit.value)
}

// ── File categories ─────────────────────────────────────────────────
const showCategoryManager = ref(false)
const categorySummary = computed(() => {
  const categories = form.value.fileCategories
  const urlRuleCount = categories.reduce((total, category) => total + (category.urlPatterns?.length ?? 0), 0)
  return t('preferences.file-category-summary', { count: categories.length, url: urlRuleCount })
})
const categoryBaseDir = computed(() => form.value.dir || defaultDownloadDir.value)
async function handleCategoryManagerSave(categories: typeof form.value.fileCategories) {
  form.value.fileCategories = categories
  const saved = await preferenceStore.updateAndSave({ fileCategories: categories })
  if (!saved) {
    message.error(t('preferences.save-fail-message'))
    return
  }
  patchSnapshot({ fileCategories: categories } as Partial<typeof form.value>)
}
async function handleSelectDir() {
  const selected = await openDialog({ directory: true, multiple: false })
  if (typeof selected === 'string') form.value.dir = selected
}
function handleRecentDirSelect(dir: string) {
  form.value.dir = dir
}
// ── Speed limit toggle ──────────────────────────────────────────────
async function handleSpeedLimitToggle() {
  if (!isEngineReady()) return
  try {
    const result = await toggleSpeedLimit(preferenceStore.config, {
      changeGlobalOption,
      updateAndSave: (partial) => preferenceStore.updateAndSave(partial),
    })
    if (result === 'enabled') message.success(t('app.speedometer-limit-applied'))
    else if (result === 'disabled') message.success(t('app.speedometer-limit-removed'))
    else message.info(t('app.speedometer-needs-config-settings'))
  } catch (e) {
    logger.error('Downloads.speedLimitToggle', e)
  }
}

async function handleScheduleToggle(enabled: boolean) {
  try {
    await preferenceStore.updateAndSave({ speedScheduleEnabled: enabled })
    message.success(t(enabled ? 'app.schedule-enabled' : 'app.schedule-disabled'))
  } catch (e) {
    logger.error('Downloads.scheduleToggle', e)
  }
}

function loadForm() {
  Object.assign(form.value, buildForm())
  completedRecordRetentionMode.value = getCompletedRecordRetentionSelectValue(
    Number(form.value.completedRecordRetentionDays),
  )
  const ul = parseSpeedLimit(form.value.maxOverallUploadLimit)
  uploadSpeedValue.value = ul.num
  uploadUnit.value = ul.unit
  const dl = parseSpeedLimit(form.value.maxOverallDownloadLimit)
  downloadSpeedValue.value = dl.num
  downloadUnit.value = dl.unit
}

onMounted(async () => {
  try {
    const resolvedDir = await resolveUserVisibleDownloadDir({ configuredDir: preferenceStore.config.dir })
    defaultDownloadDir.value = resolvedDir.path
    logger.info('Downloads.downloadDir', `resolved source=${resolvedDir.source} fallback=${resolvedDir.usedFallback}`)
  } catch (e) {
    logger.debug('Downloads.downloadDir', e)
  }
  loadForm()
  resetSnapshot()
})
</script>

<template>
  <div class="preference-form-wrapper">
    <div class="preference-form-scroll">
      <NForm
        label-placement="left"
        label-align="left"
        class="form-preference"
        :disabled="preferenceStore.savingChanges"
      >
        <!-- Download Path -->
        <h2 class="settings-section-title">{{ t('preferences.download-path') }}</h2>
        <SettingsRow setting-key="preferences.default-path" :label="t('preferences.default-path')">
          <NInputGroup>
            <NInput
              v-model:value="form.dir"
              :input-props="{ 'aria-label': t('preferences.default-path') }"
              class="pref-control-full"
            />
            <NButton class="pref-icon-button" @click="handleSelectDir">
              <template #icon>
                <NIcon :size="16"><FolderOpenOutline /></NIcon>
              </template>
            </NButton>
            <DirectoryPopover @select="handleRecentDirSelect" />
          </NInputGroup>
        </SettingsRow>
        <SettingsRow setting-key="preferences.file-timestamp" :label="t('preferences.file-timestamp')">
          <NSelect
            :aria-label="t('preferences.file-timestamp')"
            :value="fileTimestampValue"
            :options="fileTimestampOptions"
            class="pref-control-auto pref-control-file-timestamp"
            @update:value="handleFileTimestampChange"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.file-category-save">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.file-category-save')"
              :hint="t('preferences.file-category-auto-archive-hint')"
            />
          </template>
          <NSwitch v-model:value="form.fileCategoryEnabled" :aria-label="t('preferences.file-category-save')" />
        </SettingsRow>
        <SettingsRow :show-label="false">
          <div class="file-category-summary-row">
            <div class="file-category-summary-text">
              <span>{{ categorySummary }}</span>
              <NText depth="3">{{ t('preferences.file-category-manager-hint') }}</NText>
            </div>
            <NButton size="small" @click="showCategoryManager = true">
              {{ t('preferences.file-category-manage') }}
            </NButton>
          </div>
        </SettingsRow>

        <h2 class="settings-section-title">{{ t('preferences.media-downloads') }}</h2>
        <SettingsRow
          setting-key="preferences.media-select-before-download"
          :label="t('preferences.media-select-before-download')"
        >
          <NSwitch
            v-model:value="form.mediaSelectBeforeDownload"
            :aria-label="t('preferences.media-select-before-download')"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.media-default-format" :label="t('preferences.media-default-format')">
          <NSelect
            v-model:value="form.mediaDefaultFormat"
            :aria-label="t('preferences.media-default-format')"
            :options="[
              { label: 'MP4', value: 'mp4' },
              { label: 'MKV', value: 'mkv' },
            ]"
            class="pref-control-auto"
          />
        </SettingsRow>
        <h2 class="settings-section-title">{{ t('preferences.download-concurrency') }}</h2>
        <SettingsRow
          setting-key="preferences.max-concurrent-downloads"
          :label="t('preferences.max-concurrent-downloads')"
          v-bind="configFieldProps('maxConcurrentDownloads', form.maxConcurrentDownloads)"
        >
          <NInputNumber
            v-model:value="form.maxConcurrentDownloads"
            :input-props="{ 'aria-label': t('preferences.max-concurrent-downloads') }"
            :min="constraint('maxConcurrentDownloads').min"
            :max="constraint('maxConcurrentDownloads').max"
            class="pref-number"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.stream-max-connections"
          :label="t('preferences.stream-max-connections')"
          v-bind="configFieldProps('streamMaxConnections', form.streamMaxConnections)"
        >
          <NInputNumber
            v-model:value="form.streamMaxConnections"
            :input-props="{ 'aria-label': t('preferences.stream-max-connections') }"
            :min="constraint('streamMaxConnections').min"
            :max="constraint('streamMaxConnections').max"
            class="pref-number"
          />
        </SettingsRow>
        <h2 class="settings-section-title">{{ t('preferences.p2p-sharing-section') }}</h2>
        <SettingsRow setting-key="preferences.sharing-mode" :label="t('preferences.sharing-mode')">
          <NRadioGroup v-model:value="form.sharingMode" :aria-label="t('preferences.sharing-mode')" size="small">
            <NRadioButton value="stop-by-condition">
              {{ t('preferences.sharing-mode-stop-by-condition') }}
            </NRadioButton>
            <NRadioButton value="manual-stop">{{ t('preferences.sharing-mode-manual-stop') }}</NRadioButton>
          </NRadioGroup>
        </SettingsRow>
        <NCollapseTransition
          :show="form.sharingMode === 'stop-by-condition' || !!settingsRoute.hash"
          class="collapse-indent"
        >
          <SettingsRow
            setting-key="preferences.share-ratio"
            :label="t('preferences.share-ratio')"
            v-bind="configFieldProps('shareRatio', form.shareRatio)"
          >
            <NInputNumber
              v-model:value="form.shareRatio"
              :input-props="{ 'aria-label': t('preferences.share-ratio') }"
              :min="constraint('shareRatio').min"
              :max="constraint('shareRatio').max"
              :step="0.1"
              class="pref-number"
            />
          </SettingsRow>
          <SettingsRow
            :label="t('preferences.share-time') + ' (' + t('preferences.share-time-unit') + ')'"
            v-bind="configFieldProps('shareTime', form.shareTime)"
          >
            <NInputNumber
              v-model:value="form.shareTime"
              :min="constraint('shareTime').min"
              :max="constraint('shareTime').max"
              class="pref-number"
            />
          </SettingsRow>
        </NCollapseTransition>
        <NCollapseTransition :show="form.sharingMode === 'manual-stop' || !!settingsRoute.hash" class="collapse-indent">
          <SettingsRow label=" ">
            <NText depth="3">{{ t('preferences.sharing-mode-manual-stop-tips') }}</NText>
          </SettingsRow>
        </NCollapseTransition>
        <!-- Retry & File Options -->
        <h2 class="settings-section-title">{{ t('preferences.retry-and-file-behavior') }}</h2>
        <SettingsRow
          setting-key="preferences.max-tries"
          :label="t('preferences.max-tries')"
          v-bind="configFieldProps('maxTries', form.maxTries)"
        >
          <NInputNumber
            v-model:value="form.maxTries"
            :input-props="{ 'aria-label': t('preferences.max-tries') }"
            :min="constraint('maxTries').min"
            :max="constraint('maxTries').max"
            class="pref-number"
          />
          <NText depth="3" class="pref-inline-note">
            {{ t('preferences.max-tries-hint') }}
          </NText>
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.retry-wait"
          :label="t('preferences.retry-wait')"
          v-bind="configFieldProps('retryWait', form.retryWait)"
        >
          <NInputNumber
            v-model:value="form.retryWait"
            :input-props="{ 'aria-label': t('preferences.retry-wait') }"
            :min="constraint('retryWait').min"
            :max="constraint('retryWait').max"
            class="pref-number"
          />
          <NText depth="3" class="pref-inline-note">{{ t('preferences.unit-seconds') }}</NText>
        </SettingsRow>
        <SettingsRow setting-key="preferences.continue" :label="t('preferences.continue')">
          <NSwitch v-model:value="form.continue" :aria-label="t('preferences.continue')" />
        </SettingsRow>

        <!-- Speed Limit -->
        <h2 class="settings-section-title">{{ t('preferences.speed-limit') }}</h2>
        <SettingsRow setting-key="app.speedometer-enable-limit" :label="t('app.speedometer-enable-limit')">
          <NSwitch
            :aria-label="t('app.speedometer-enable-limit')"
            :value="preferenceStore.config.speedLimitEnabled"
            @update:value="handleSpeedLimitToggle"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.speed-schedule-enabled">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.speed-schedule-enabled')"
              :hint="t('preferences.schedule-hint')"
            />
          </template>
          <NSwitch
            :aria-label="t('preferences.speed-schedule-enabled')"
            :value="preferenceStore.config.speedScheduleEnabled"
            @update:value="handleScheduleToggle"
          />
        </SettingsRow>
        <NCollapseTransition
          :show="preferenceStore.config.speedScheduleEnabled || !!settingsRoute.hash"
          class="collapse-indent"
        >
          <SettingsRow v-if="!preferenceStore.config.speedLimitEnabled" :show-label="false">
            <NText depth="3" type="warning" class="pref-inline-note pref-inline-note--warning">
              {{ t('preferences.schedule-needs-limit') }}
            </NText>
          </SettingsRow>

          <SettingsRow setting-key="preferences.schedule-from" :label="t('preferences.schedule-from')">
            <NSelect
              v-model:value="form.speedScheduleFrom"
              :aria-label="t('preferences.schedule-from')"
              :options="timeOptions"
              class="pref-control-auto"
            />
          </SettingsRow>
          <SettingsRow setting-key="preferences.schedule-to" :label="t('preferences.schedule-to')">
            <NSelect
              v-model:value="form.speedScheduleTo"
              :aria-label="t('preferences.schedule-to')"
              :options="timeOptions"
              class="pref-control-auto"
            />
          </SettingsRow>
          <SettingsRow setting-key="preferences.schedule-days" :label="t('preferences.schedule-days')">
            <NSelect
              v-model:value="form.speedScheduleDays"
              :aria-label="t('preferences.schedule-days')"
              :options="scheduleDayOptions"
              class="pref-control-auto"
            />
          </SettingsRow>
        </NCollapseTransition>
        <div>
          <SettingsRow setting-key="preferences.transfer-speed-upload" :label="t('preferences.transfer-speed-upload')">
            <NInputGroup>
              <NInputNumber
                :input-props="{ 'aria-label': t('preferences.transfer-speed-upload') }"
                :value="uploadSpeedValue"
                :min="0"
                :max="65535"
                :step="1"
                class="pref-port"
                @update:value="handleUploadValueChange"
              />
              <NSelect
                :aria-label="t('preferences.transfer-speed-upload')"
                :value="uploadUnit"
                :options="speedUnitOptions"
                class="pref-control-auto pref-control-compact"
                @update:value="handleUploadUnitChange"
              />
            </NInputGroup>
          </SettingsRow>
          <SettingsRow
            setting-key="preferences.transfer-speed-download"
            :label="t('preferences.transfer-speed-download')"
          >
            <NInputGroup>
              <NInputNumber
                :input-props="{ 'aria-label': t('preferences.transfer-speed-download') }"
                :value="downloadSpeedValue"
                :min="0"
                :max="65535"
                :step="1"
                class="pref-port"
                @update:value="handleDownloadValueChange"
              />
              <NSelect
                :aria-label="t('preferences.transfer-speed-download')"
                :value="downloadUnit"
                :options="speedUnitOptions"
                class="pref-control-auto pref-control-compact"
                @update:value="handleDownloadUnitChange"
              />
            </NInputGroup>
          </SettingsRow>
        </div>

        <!-- Notification & Confirm -->
        <h2 class="settings-section-title">{{ t('preferences.notification-and-confirm') }}</h2>
        <SettingsRow
          setting-key="preferences.new-task-show-downloading"
          :label="t('preferences.new-task-show-downloading')"
        >
          <NSwitch
            v-model:value="form.newTaskShowDownloading"
            :aria-label="t('preferences.new-task-show-downloading')"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.file-deletion-mode" :label="t('preferences.file-deletion-mode')">
          <NSelect
            v-model:value="form.fileDeletionMode"
            :aria-label="t('preferences.file-deletion-mode')"
            :options="fileDeletionModeOptions"
            class="pref-control-auto"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.no-confirm-before-delete-task"
          :label="t('preferences.no-confirm-before-delete-task')"
        >
          <NSwitch
            v-model:value="form.noConfirmBeforeDeleteTask"
            :aria-label="t('preferences.no-confirm-before-delete-task')"
          />
        </SettingsRow>
        <NCollapseTransition :show="form.noConfirmBeforeDeleteTask || !!settingsRoute.hash">
          <SettingsRow label=" ">
            <NCheckbox v-model:checked="form.deleteFilesWhenSkipConfirm">
              {{ skipConfirmationFileLabel }}
            </NCheckbox>
          </SettingsRow>
        </NCollapseTransition>
        <SettingsRow setting-key="preferences.task-completed-notify" :label="t('preferences.task-completed-notify')">
          <NSwitch v-model:value="form.taskNotification" :aria-label="t('preferences.task-completed-notify')" />
        </SettingsRow>
        <NCollapseTransition :show="form.taskNotification || !!settingsRoute.hash">
          <SettingsRow label=" ">
            <PreferenceCheckboxGrid v-model:value="selectedNotificationTypes" :options="notificationTypeOptions" />
          </SettingsRow>
        </NCollapseTransition>
        <SettingsRow setting-key="preferences.shutdown-when-complete" :label="t('preferences.shutdown-when-complete')">
          <NSwitch v-model:value="form.shutdownWhenComplete" :aria-label="t('preferences.shutdown-when-complete')" />
        </SettingsRow>
        <SettingsRow setting-key="preferences.keep-awake" :label="t('preferences.keep-awake')">
          <NSwitch v-model:value="form.keepAwake" :aria-label="t('preferences.keep-awake')" />
        </SettingsRow>

        <!-- Auto Cleanup -->
        <h2 class="settings-section-title">{{ t('preferences.auto-cleanup') }}</h2>
        <SettingsRow
          setting-key="preferences.delete-torrent-after-complete"
          :label="t('preferences.delete-torrent-after-complete')"
        >
          <NSwitch
            v-model:value="form.deleteTorrentAfterComplete"
            :aria-label="t('preferences.delete-torrent-after-complete')"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.auto-delete-stale-records"
          :label="t('preferences.auto-delete-stale-records')"
        >
          <NSwitch
            v-model:value="form.autoDeleteStaleRecords"
            :aria-label="t('preferences.auto-delete-stale-records')"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.clear-completed-on-exit"
          :label="t('preferences.clear-completed-on-exit')"
        >
          <NSwitch v-model:value="form.clearCompletedOnExit" :aria-label="t('preferences.clear-completed-on-exit')" />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.completed-record-retention"
          :label="t('preferences.completed-record-retention')"
        >
          <NSelect
            v-model:value="completedRecordRetentionSelectValue"
            :aria-label="t('preferences.completed-record-retention')"
            :options="completedRecordRetentionOptions"
            class="pref-control-auto"
          />
        </SettingsRow>
        <NCollapseTransition :show="completedRecordRetentionSelectValue === -1 || !!settingsRoute.hash">
          <SettingsRow
            setting-key="preferences.completed-record-retention-custom-days"
            :label="t('preferences.completed-record-retention-custom-days')"
            v-bind="fieldProps(form.completedRecordRetentionDays, { min: 1, max: 3650, integer: true })"
          >
            <NInputNumber
              v-model:value="form.completedRecordRetentionDays"
              :input-props="{ 'aria-label': t('preferences.completed-record-retention-custom-days') }"
              :min="1"
              :max="3650"
              class="pref-number"
            />
            <NText depth="3" class="pref-inline-note">
              {{ t('preferences.completed-record-retention-days-unit') }}
            </NText>
          </SettingsRow>
        </NCollapseTransition>
      </NForm>
    </div>
    <PreferenceActionBar
      :is-saving="preferenceStore.savingChanges"
      :is-dirty="isDirty"
      :is-valid="numericFieldsValid"
      @save="handleSave"
      @discard="handleReset"
    />
    <FileCategoryManager
      v-model:show="showCategoryManager"
      :categories="form.fileCategories"
      :base-dir="categoryBaseDir"
      @save="handleCategoryManagerSave"
    />
  </div>
</template>

<style scoped>
.pref-control-compact {
  min-width: 80px;
}

.pref-control-file-timestamp {
  min-width: 200px;
}

.file-category-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding-block: 4px;
}

.file-category-summary-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
</style>
