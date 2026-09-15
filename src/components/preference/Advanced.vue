<script setup lang="ts">
import { useRoute } from 'vue-router'
import SettingsRow from './SettingsRow.vue'
/** @fileoverview Advanced preferences: clipboard, system integration, engine maintenance, and diagnostics. */
import { ref, computed, onMounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { usePlatform } from '@/composables/usePlatform'
import { useI18n } from 'vue-i18n'
import { usePreferenceStore } from '@/stores/preference'
import { usePreferenceForm } from '@/composables/usePreferenceForm'
import { useEngineStore } from '@/stores/engine'
import { useHistoryStore } from '@/stores/history'
import { useAdvancedActions } from '@/composables/useAdvancedActions'
import { useEngineRestart } from '@/composables/useEngineRestart'
import { useProtocolHandlers, type ProtocolKey } from '@/composables/useProtocolHandlers'
import { relaunch } from '@tauri-apps/plugin-process'
import { appDataDir, appLogDir, join, tempDir } from '@tauri-apps/api/path'
import { APP_LOG_LEVELS, ARIA2_LOG_LEVELS } from '@shared/constants'
import { buildAdvancedForm, transformAdvancedForStore } from '@/composables/useAdvancedPreference'
import {
  NForm,
  NInput,
  NInputGroup,
  NSwitch,
  NSelect,
  NButton,
  NSpace,
  NIcon,
  NModal,
  NCard,
  NDataTable,
  NEmpty,
  NCollapseTransition,
  useDialog,
} from 'naive-ui'
import { useAppMessage } from '@/composables/useAppMessage'
import { CloudDownload, CloudUpload, Download, FolderOpen, Trash2, Copy } from '@lucide/vue'
import { logger } from '@shared/logger'
import PreferenceActionBar from './PreferenceActionBar.vue'
import PreferenceCheckboxGrid from './PreferenceCheckboxGrid.vue'
import PreferenceHintLabel from './PreferenceHintLabel.vue'

const engineStore = useEngineStore()
const { confirmManualRestart } = useEngineRestart()

const settingsRoute = useRoute()
const { t } = useI18n()
const preferenceStore = usePreferenceStore()
const historyStore = useHistoryStore()
const message = useAppMessage()
const dialog = useDialog()
const protocolHandlers = useProtocolHandlers()
const protocolStatus = protocolHandlers.status
const protocolPending = protocolHandlers.pending
const protocolBusy = protocolHandlers.busy
const protocolOptions = computed<{ key: ProtocolKey; label: string }[]>(() => [
  { key: 'magnet', label: t('preferences.protocol-magnet') },
  { key: 'ed2k', label: t('preferences.protocol-ed2k') },
  { key: 'thunder', label: t('preferences.protocol-thunder') },
  { key: 'rayburst', label: t('preferences.protocol-rayburst') },
])

useEventListener(window, 'focus', () => protocolHandlers.refreshAll())

const { isLinux } = usePlatform()

import { diffConfig } from '@shared/utils/config'
import { writeAppClipboardText } from '@shared/utils'

const appLogLevelOptions = APP_LOG_LEVELS.map((level) => ({ label: level, value: level }))
const aria2LogLevelOptions = ARIA2_LOG_LEVELS.map((level) => ({ label: level, value: level }))

type ClipboardType = 'http' | 'sftp' | 'magnet' | 'ed2k' | 'thunder' | 'btHash'
const clipboardTypes: ClipboardType[] = ['http', 'sftp', 'magnet', 'ed2k', 'thunder', 'btHash']
const clipboardTypeOptions = computed(() => [
  { label: t('preferences.clipboard-http'), value: 'http' },
  { label: t('preferences.clipboard-sftp'), value: 'sftp' },
  { label: t('preferences.clipboard-magnet'), value: 'magnet' },
  { label: t('preferences.clipboard-ed2k'), value: 'ed2k' },
  { label: t('preferences.clipboard-thunder'), value: 'thunder' },
  { label: t('preferences.clipboard-bt-hash'), value: 'btHash' },
])
const clipboardFieldByType: Record<ClipboardType, keyof typeof form.value> = {
  http: 'clipboardHttp',
  sftp: 'clipboardSftp',
  magnet: 'clipboardMagnet',
  ed2k: 'clipboardEd2k',
  thunder: 'clipboardThunder',
  btHash: 'clipboardBtHash',
}
const selectedClipboardTypes = computed<string[]>({
  get: () => clipboardTypes.filter((type) => !!form.value[clipboardFieldByType[type]]),
  set: (types) => {
    const selected = new Set(types)
    for (const type of clipboardTypes) {
      form.value[clipboardFieldByType[type]] = selected.has(type)
    }
  },
})

const aria2ConfPath = ref('')
const engineStatePath = ref('')
const logPath = ref('')
const defaultTempPath = ref('')

const { form, isDirty, handleSave, handleReset, resetSnapshot } = usePreferenceForm({
  buildForm,
  transformForStore: transformAdvancedForStore,
  afterSave: async (f, prevConfig) => {
    const changed = diffConfig(prevConfig, f)

    if (changed.logLevel !== undefined && changed.logLevel !== prevConfig.logLevel) {
      await invoke('set_app_log_level', { level: f.logLevel })
    }

    if (changed.aria2LogLevel !== undefined && changed.aria2LogLevel !== prevConfig.aria2LogLevel) {
      try {
        await invoke('aria2_change_global_option', {
          options: { 'log-level': f.aria2LogLevel },
        })
      } catch (error) {
        if (engineStore.isReady) throw error
      }
    }

    // WebKitGTK rendering variables are read at process startup.
    if (changed.hardwareRendering !== undefined && changed.hardwareRendering !== prevConfig.hardwareRendering) {
      dialog.info({
        title: t('preferences.restart-required'),
        content: t('preferences.hardware-rendering-restart-confirm'),
        positiveText: t('preferences.restart-now'),
        negativeText: t('preferences.engine-restart-later'),
        maskClosable: false,
        onPositiveClick: async () => {
          await engineStore.stop('appRelaunch')
          await relaunch()
        },
      })
    }
  },
})

function buildForm() {
  return buildAdvancedForm(preferenceStore.config)
}

function loadForm() {
  Object.assign(form.value, buildForm())
}

async function handleProtocolToggle(protocol: ProtocolKey, enabled: boolean) {
  const result = await protocolHandlers.setProtocolEnabled(protocol, enabled)
  switch (result.kind) {
    case 'success':
      message.success(
        enabled
          ? t('preferences.protocol-registered', { protocol })
          : t('preferences.protocol-unregistered', { protocol }),
      )
      break
    case 'failed':
      message.error(
        enabled
          ? t('preferences.protocol-register-failed', { protocol, reason: result.reason })
          : t('preferences.protocol-unregister-failed', { protocol, reason: result.reason }),
      )
      break
    case 'unchanged':
      message.warning(t('preferences.protocol-unchanged', { protocol }))
      break
    case 'manual':
      message.info(t('preferences.protocol-manual-required'))
      break
    case 'query-failed':
      message.error(t('preferences.protocol-query-failed', { protocol }))
      break
  }
}

async function loadPaths() {
  try {
    aria2ConfPath.value = await invoke<string>('get_engine_conf_path')
  } catch (e) {
    aria2ConfPath.value = ''
    logger.debug('Advanced.loadConf', e)
  }
  try {
    const dataDir = await appDataDir()
    engineStatePath.value = await join(dataDir, 'engine', 'state')
  } catch (e) {
    logger.debug('Advanced.loadPaths', e)
  }
  try {
    const logDir = await appLogDir()
    logPath.value = await join(logDir, 'rayburst.log')
  } catch (e) {
    logger.debug('Advanced.loadLogPath', e)
  }
  try {
    defaultTempPath.value = await tempDir()
  } catch (e) {
    logger.debug('Advanced.loadTempPath', e)
  }
}

async function copyToClipboard(text: string, label: string) {
  if (!text) return
  try {
    await writeAppClipboardText(text)
    message.success(t('preferences.copied-to-clipboard', { label }))
  } catch (e) {
    logger.debug('Advanced.clipboard', `writeText failed: ${e}`)
  }
}

async function handleSelectTempDir() {
  const selected = await openDialog({ directory: true, multiple: false })
  if (typeof selected === 'string') form.value.tempFilesDir = selected
}

function handleClearTempDir() {
  form.value.tempFilesDir = ''
}

// ─── Advanced Actions (delegated to composable) ─────────────────────

const {
  showDbBrowse,
  dbRecords,
  dbRecordsLoading,
  dbBrowseColumns,
  dbBrowsePagination,
  handleDbSorterChange,
  exportingLogs,
  exportingSettings,
  importingSettings,
  handleEngineStateReset,
  handleRestoreDefaults,
  handleFactoryReset,
  handleDbIntegrityCheck,
  handleDbBrowse,
  handleDbReset,
  handleExportLogs,
  handleExportSettings,
  handleImportSettings,
  handleClearLog,
  handleRevealPath,
  handleOpenConfigFolder,
} = useAdvancedActions({
  t,
  message,
  historyStore,
  preferenceStore,
  form,
  buildForm,
  resetSnapshot,
})

onMounted(async () => {
  loadForm()
  resetSnapshot()
  loadPaths()

  await protocolHandlers.refreshAll()
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
        <h2 class="settings-section-title">{{ t('preferences.engine-section') }}</h2>
        <SettingsRow setting-key="preferences.engine-maintenance" :label="t('preferences.engine-maintenance')" actions>
          <div class="settings-action-group">
            <NButton :disabled="engineStore.isBusy" @click="confirmManualRestart">{{
              t('preferences.engine-restart-now')
            }}</NButton>
            <NButton type="error" ghost :disabled="engineStore.isBusy" @click="handleEngineStateReset">{{
              t('preferences.reset-engine-state')
            }}</NButton>
          </div>
        </SettingsRow>
        <SettingsRow setting-key="preferences.temp-files-dir" :label="t('preferences.temp-files-dir')">
          <NInputGroup>
            <NInput
              :input-props="{ 'aria-label': t('preferences.temp-files-dir') }"
              :value="form.tempFilesDir || defaultTempPath"
              readonly
              class="pref-control-full"
              :placeholder="defaultTempPath"
            />
            <NButton
              class="pref-icon-button"
              @click="copyToClipboard(form.tempFilesDir || defaultTempPath, t('preferences.temp-files-dir'))"
            >
              <template #icon>
                <NIcon :size="14"><Copy /></NIcon>
              </template>
            </NButton>
            <NButton class="pref-icon-button" @click="handleSelectTempDir">
              <template #icon>
                <NIcon :size="14"><FolderOpen /></NIcon>
              </template>
            </NButton>
            <NButton v-if="form.tempFilesDir" quaternary class="pref-icon-button" @click="handleClearTempDir">
              {{ t('preferences.ua-reset') }}
            </NButton>
          </NInputGroup>
        </SettingsRow>
        <SettingsRow setting-key="preferences.aria2-conf-path" :label="t('preferences.aria2-conf-path')">
          <NInputGroup>
            <NInput
              :input-props="{ 'aria-label': t('preferences.aria2-conf-path') }"
              :value="aria2ConfPath"
              readonly
              class="pref-control-full"
            />
            <NButton class="pref-icon-button" @click="copyToClipboard(aria2ConfPath, t('preferences.aria2-conf-path'))">
              <template #icon>
                <NIcon :size="14"><Copy /></NIcon>
              </template>
            </NButton>
            <NButton class="pref-icon-button" @click="handleRevealPath(aria2ConfPath)">
              <template #icon>
                <NIcon :size="14"><FolderOpen /></NIcon>
              </template>
            </NButton>
          </NInputGroup>
        </SettingsRow>
        <SettingsRow setting-key="preferences.engine-state-path" :label="t('preferences.engine-state-path')">
          <NInputGroup>
            <NInput
              :input-props="{ 'aria-label': t('preferences.engine-state-path') }"
              :value="engineStatePath"
              readonly
              class="pref-control-full"
            />
            <NButton
              class="pref-icon-button"
              @click="copyToClipboard(engineStatePath, t('preferences.engine-state-path'))"
            >
              <template #icon>
                <NIcon :size="14"><Copy /></NIcon>
              </template>
            </NButton>
            <NButton class="pref-icon-button" @click="handleRevealPath(engineStatePath)">
              <template #icon>
                <NIcon :size="14"><FolderOpen /></NIcon>
              </template>
            </NButton>
          </NInputGroup>
        </SettingsRow>
        <h2 class="settings-section-title">{{ t('preferences.log-section') }}</h2>
        <SettingsRow setting-key="preferences.log-path" :label="t('preferences.log-path')">
          <NInputGroup>
            <NInput
              :input-props="{ 'aria-label': t('preferences.log-path') }"
              :value="logPath"
              readonly
              class="pref-control-full"
            />
            <NButton class="pref-icon-button" @click="copyToClipboard(logPath, t('preferences.log-path'))">
              <template #icon>
                <NIcon :size="14"><Copy /></NIcon>
              </template>
            </NButton>
            <NButton class="pref-icon-button" @click="handleRevealPath(logPath)">
              <template #icon>
                <NIcon :size="14"><FolderOpen /></NIcon>
              </template>
            </NButton>
          </NInputGroup>
        </SettingsRow>
        <SettingsRow setting-key="preferences.log-level" :label="t('preferences.log-level')">
          <div class="log-level-row">
            <div class="log-level-control">
              <span class="log-level-control__label">{{ t('preferences.rayburst') }}</span>
              <NSelect
                v-model:value="form.logLevel"
                :aria-label="t('preferences.log-level')"
                :options="appLogLevelOptions"
                class="pref-control-auto pref-control-log-level"
              />
            </div>
            <div class="log-level-control">
              <span class="log-level-control__label">{{ t('preferences.aria2-next') }}</span>
              <NSelect
                v-model:value="form.aria2LogLevel"
                :aria-label="t('preferences.log-level')"
                :options="aria2LogLevelOptions"
                class="pref-control-auto pref-control-log-level"
              />
            </div>
          </div>
        </SettingsRow>
        <SettingsRow :label="t('preferences.log-management')" actions>
          <div class="settings-action-group">
            <NButton :loading="exportingLogs" @click="handleExportLogs">
              <template #icon>
                <NIcon><Download /></NIcon>
              </template>
              {{ t('preferences.export-diagnostic-logs') }}
            </NButton>
            <NButton type="error" ghost @click="handleClearLog">
              <template #icon>
                <NIcon><Trash2 /></NIcon>
              </template>
              {{ t('preferences.clear-log') }}
            </NButton>
          </div>
        </SettingsRow>

        <h2 class="settings-section-title">{{ t('preferences.maintenance-section') }}</h2>
        <SettingsRow v-if="isLinux" setting-key="preferences.hardware-rendering">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.hardware-rendering')"
              :hint="t('preferences.hardware-rendering-hint')"
            />
          </template>
          <NSwitch v-model:value="form.hardwareRendering" :aria-label="t('preferences.hardware-rendering')" />
        </SettingsRow>
        <SettingsRow setting-key="preferences.history-section" :label="t('preferences.history-section')" actions>
          <div class="settings-action-group">
            <NButton class="db-integrity-check-btn" @click="handleDbIntegrityCheck">
              {{ t('preferences.db-integrity-check') }}
            </NButton>
            <NButton class="db-browse-btn" @click="handleDbBrowse">
              {{ t('preferences.db-browse') }}
            </NButton>
            <NButton type="error" ghost @click="handleDbReset">
              {{ t('preferences.db-reset') }}
            </NButton>
          </div>
        </SettingsRow>

        <SettingsRow
          setting-key="preferences.configuration-section"
          :label="t('preferences.configuration-section')"
          actions
        >
          <div class="settings-action-group">
            <NButton class="open-config-folder-btn" @click="handleOpenConfigFolder">
              <template #icon>
                <NIcon :size="14"><FolderOpen /></NIcon>
              </template>
              {{ t('preferences.open-config-folder') }}
            </NButton>
            <NButton type="error" ghost @click="handleRestoreDefaults">
              {{ t('preferences.restore-defaults') }}
            </NButton>
            <NButton type="error" ghost @click="handleFactoryReset">
              {{ t('preferences.factory-reset') }}
            </NButton>
          </div>
        </SettingsRow>
        <SettingsRow setting-key="preferences.settings-backup" :label="t('preferences.settings-backup')" actions>
          <div class="settings-action-group">
            <NButton :loading="exportingSettings" @click="handleExportSettings">
              <template #icon>
                <NIcon><CloudDownload /></NIcon>
              </template>
              {{ t('preferences.export-settings') }}
            </NButton>
            <NButton :loading="importingSettings" @click="handleImportSettings">
              <template #icon>
                <NIcon><CloudUpload /></NIcon>
              </template>
              {{ t('preferences.import-settings') }}
            </NButton>
          </div>
        </SettingsRow>

        <!-- Clipboard Detection (migrated from Basic) -->
        <h2 class="settings-section-title">{{ t('preferences.clipboard-detection') }}</h2>
        <SettingsRow setting-key="preferences.clipboard-auto-detect">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.clipboard-auto-detect')"
              :hint="t('preferences.clipboard-filter-hint')"
            />
          </template>
          <NSwitch v-model:value="form.clipboardEnable" :aria-label="t('preferences.clipboard-auto-detect')" />
        </SettingsRow>
        <NCollapseTransition :show="form.clipboardEnable || !!settingsRoute.hash" class="collapse-indent">
          <SettingsRow :label="t('preferences.clipboard-types')">
            <PreferenceCheckboxGrid v-model:value="selectedClipboardTypes" :options="clipboardTypeOptions" />
          </SettingsRow>
        </NCollapseTransition>

        <!-- Default programs reflect the current OS association, not a saved preference. -->
        <h2 class="settings-section-title">{{ t('preferences.default-programs') }}</h2>
        <SettingsRow v-for="protocol in protocolOptions" :key="protocol.key" :label="protocol.label">
          <NSwitch
            v-if="protocolStatus[protocol.key] !== null"
            :value="protocolStatus[protocol.key] === true"
            :disabled="protocolBusy || protocolStatus[protocol.key] === undefined"
            :loading="protocolPending === protocol.key || protocolStatus[protocol.key] === undefined"
            :aria-label="protocol.label"
            @update:value="(value) => handleProtocolToggle(protocol.key, value)"
          />
          <NSpace v-else align="center">
            <span role="status">{{ t('preferences.protocol-query-failed', { protocol: protocol.key }) }}</span>
            <NButton size="small" :disabled="protocolBusy" @click="protocolHandlers.refreshAll()">
              {{ t('app.retry') }}
            </NButton>
          </NSpace>
        </SettingsRow>
      </NForm>
    </div>

    <!-- Database records viewer modal -->
    <NModal v-model:show="showDbBrowse" :mask-closable="true" transform-origin="center">
      <NCard
        :title="t('preferences.db-browse-title')"
        closable
        class="db-record-modal"
        content-class="db-record-content"
        :bordered="false"
        @close="showDbBrowse = false"
      >
        <NDataTable
          :columns="dbBrowseColumns"
          :data="dbRecords"
          :loading="dbRecordsLoading"
          remote
          :pagination="dbBrowsePagination"
          :max-height="420"
          :scroll-x="700"
          size="small"
          striped
          @update:sorter="handleDbSorterChange"
        >
          <template #empty>
            <NEmpty :description="t('preferences.db-record-count', { count: 0 })" />
          </template>
        </NDataTable>
      </NCard>
    </NModal>
    <PreferenceActionBar
      :is-saving="preferenceStore.savingChanges"
      :is-dirty="isDirty"
      @save="handleSave"
      @discard="handleReset"
    />
  </div>
</template>

<style scoped>
.log-level-row {
  display: flex;
  justify-content: var(--settings-control-align);
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.db-record-modal {
  width: min(760px, calc(100vw - 96px));
  max-height: min(620px, calc(100vh - 96px));
  display: flex;
  flex-direction: column;
}
.db-record-modal :deep(.db-record-content) {
  min-height: 0;
  overflow: auto;
}
.log-level-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.pref-control-log-level {
  min-width: 100px;
}
.log-level-control__label {
  color: var(--rb-text);
  font-size: 13px;
  white-space: nowrap;
}
</style>
