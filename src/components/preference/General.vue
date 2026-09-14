<script setup lang="ts">
import { useRoute } from 'vue-router'
import SettingsRow from './SettingsRow.vue'
/** @fileoverview General preference tab: appearance, language, updates, and window behavior. */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferenceStore } from '@/stores/preference'
import { useAppStore } from '@/stores/app'
import { usePreferenceForm } from '@/composables/usePreferenceForm'
import { useEngineStore } from '@/stores/engine'
import { relaunch } from '@tauri-apps/plugin-process'
import { usePlatform } from '@/composables/usePlatform'
import { getLocale } from 'tauri-plugin-locale-api'
import { resolveSystemLocale } from '@shared/utils/locale'
import { loadLocale } from '@/composables/useLocale'
import { isSupportedLocale, LOCALE_CATALOG, SUPPORTED_LOCALES } from '@shared/localeCatalog'
import { logger } from '@shared/logger'
import { buildGeneralForm } from '@/composables/useGeneralPreference'
import { COLOR_SCHEMES, CUSTOM_COLOR_SCHEME_ID } from '@shared/constants'
import { normalizeCustomColorScheme } from '@shared/utils/colorSchemeConfig'
import { useAppMessage } from '@/composables/useAppMessage'
import {
  NForm,
  NSelect,
  NSwitch,
  NButton,
  NText,
  NCollapseTransition,
  NRadioGroup,
  NRadioButton,
  NColorPicker,
  NIcon,
  useDialog,
} from 'naive-ui'
import PreferenceActionBar from './PreferenceActionBar.vue'
import { CloudDownloadOutline } from '@vicons/ionicons5'
import type { UpdateChannel } from '@shared/types'
import PreferenceHintLabel from './PreferenceHintLabel.vue'

const settingsRoute = useRoute()
const { t } = useI18n()
const preferenceStore = usePreferenceStore()
const appStore = useAppStore()
const dialog = useDialog()
const message = useAppMessage()
const { isMac, isLinux } = usePlatform()

const detectedLocaleCode = ref('en-US')
const appearanceBusy = ref(false)
const checkIntervalOptions = computed(() => [
  { label: t('preferences.interval-every-startup'), value: 0 },
  { label: t('preferences.interval-daily'), value: 24 },
  { label: t('preferences.interval-weekly'), value: 168 },
  { label: t('preferences.interval-monthly'), value: 720 },
  { label: t('preferences.interval-semi-annual'), value: 4320 },
  { label: t('preferences.interval-yearly'), value: 8760 },
])

const CUSTOM_COLOR_SWATCHES = ['#F59E0B', '#2563EB', '#14B8A6', '#DC2626', '#9333EA', '#4B5563']

function buildForm() {
  return buildGeneralForm(preferenceStore.config)
}

const { form, isDirty, handleSave, handleReset, patchSnapshot } = usePreferenceForm({
  buildForm,
  afterSave: async (f, prevConfig) => {
    if (f.openAtLogin !== !!prevConfig.openAtLogin) {
      const { isEnabled, enable, disable } = await import('@tauri-apps/plugin-autostart')
      const enabled = await isEnabled()
      if (f.openAtLogin && !enabled) await enable()
      else if (!f.openAtLogin && enabled) await disable()
    }

    // Locale change → restart prompt
    const prevLocale = prevConfig.locale || 'auto'
    if (f.locale !== prevLocale) {
      // Show the restart prompt in the selected language.
      const targetLocale = isSupportedLocale(f.locale)
        ? f.locale
        : resolveSystemLocale(detectedLocaleCode.value, SUPPORTED_LOCALES)
      await loadLocale(targetLocale)
      const tt = (key: string) => t(key, {}, { locale: targetLocale })
      dialog.info({
        title: tt('preferences.language-changed-title'),
        content: tt('preferences.language-changed-content'),
        positiveText: tt('preferences.language-changed-restart'),
        negativeText: tt('preferences.language-changed-later'),
        onPositiveClick: async () => {
          await engineStore.stop('appRelaunch')
          await relaunch()
        },
      })
    }
  },
  afterRollback: async (previous, attempted) => {
    if (attempted.openAtLogin === previous.openAtLogin) return
    const { enable, disable } = await import('@tauri-apps/plugin-autostart')
    if (previous.openAtLogin) await enable()
    else await disable()
  },
})

async function saveAppearance(patch: Partial<ReturnType<typeof buildGeneralForm>>) {
  if (appearanceBusy.value) return
  const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, form.value[key]]))
  appearanceBusy.value = true
  preferenceStore.savingChanges = true
  Object.assign(form.value, patch)
  try {
    if (!(await preferenceStore.updateAndSave(patch))) throw new Error('Appearance persistence failed')
    patchSnapshot(patch)
  } catch (error) {
    Object.assign(form.value, previous)
    message.error(t('preferences.save-fail-message'))
    logger.error('General.appearance', error)
  } finally {
    appearanceBusy.value = false
    preferenceStore.savingChanges = false
  }
}
const colorOptions = computed(() => COLOR_SCHEMES.map((scheme) => ({ label: t(scheme.labelKey), value: scheme.id })))

// ── Lightweight mode ↔ Minimize-to-tray linkage ─────────────────────
watch(
  () => form.value.lightweightMode,
  (enabled) => {
    if (enabled && !form.value.minimizeToTrayOnClose) {
      form.value.minimizeToTrayOnClose = true
    }
  },
)
watch(
  () => form.value.minimizeToTrayOnClose,
  (enabled) => {
    if (!enabled && form.value.lightweightMode) {
      form.value.lightweightMode = false
    }
  },
)

const localeOptions = LOCALE_CATALOG.map(({ code, label }) => ({ label: label.split(' · ')[0], value: code }))

const fullLocaleOptions = computed(() => [{ label: t('preferences.follow-system'), value: 'auto' }, ...localeOptions])

const themeOptions = computed(() => [
  { label: t('preferences.theme-auto'), value: 'auto' as const },
  { label: t('preferences.theme-light'), value: 'light' as const },
  { label: t('preferences.theme-dark'), value: 'dark' as const },
])

const taskCardModeOptions = computed(() => [
  { label: t('preferences.task-card-mode-full'), value: 'full' },
  { label: t('preferences.task-card-mode-compact'), value: 'compact' },
])

function handleCheckUpdate() {
  appStore.requestUpdateCheck()
}

const engineStore = useEngineStore()

onMounted(async () => {
  try {
    detectedLocaleCode.value = resolveSystemLocale((await getLocale()) || 'en-US', SUPPORTED_LOCALES)
  } catch (error) {
    logger.debug('General.locale', error)
  }
})
</script>

<template>
  <div class="preference-form-wrapper">
    <div class="preference-form-scroll">
      <NForm
        label-placement="left"
        label-align="left"
        class="form-preference"
        :disabled="preferenceStore.savingChanges || appearanceBusy"
      >
        <!-- Appearance -->
        <h2 class="settings-section-title">{{ t('preferences.appearance-section') }}</h2>
        <SettingsRow
          setting-key="preferences.appearance"
          :hint="t('preferences.theme-hint')"
          :label="t('preferences.appearance')"
        >
          <NRadioGroup
            :aria-label="t('preferences.appearance')"
            :value="form.theme"
            @update:value="(value) => saveAppearance({ theme: value })"
          >
            <NRadioButton v-for="option in themeOptions" :key="option.value" :value="option.value">{{
              option.label
            }}</NRadioButton>
          </NRadioGroup>
        </SettingsRow>
        <SettingsRow setting-key="preferences.color-scheme" :label="t('preferences.color-scheme')">
          <NSelect
            :aria-label="t('preferences.color-scheme')"
            :value="form.colorScheme"
            :options="colorOptions"
            class="pref-control-auto"
            @update:value="(value) => saveAppearance({ colorScheme: value })"
          />
        </SettingsRow>
        <SettingsRow setting-key="preferences.custom-color-scheme" :label="t('preferences.custom-color-scheme')">
          <div class="custom-color-picker-wrap">
            <NColorPicker
              :value="form.customColorScheme"
              :modes="['hex']"
              :show-alpha="false"
              :show-preview="true"
              :swatches="CUSTOM_COLOR_SWATCHES"
              @complete="
                (value) =>
                  saveAppearance({
                    customColorScheme: normalizeCustomColorScheme(value),
                    colorScheme: CUSTOM_COLOR_SCHEME_ID,
                  })
              "
            />
          </div>
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.task-card-mode"
          :hint="t('preferences.density-hint')"
          :label="t('preferences.task-card-mode')"
        >
          <NRadioGroup
            :aria-label="t('preferences.task-card-mode')"
            :value="form.taskCardMode"
            @update:value="(value) => saveAppearance({ taskCardMode: value })"
          >
            <NRadioButton v-for="option in taskCardModeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </NRadioButton>
          </NRadioGroup>
        </SettingsRow>
        <SettingsRow setting-key="preferences.reduce-motion" :label="t('preferences.reduce-motion')">
          <NSwitch
            :aria-label="t('preferences.reduce-motion')"
            :value="form.reduceMotion"
            @update:value="(value) => saveAppearance({ reduceMotion: value })"
          />
        </SettingsRow>
        <SettingsRow
          setting-key="preferences.sidebar-task-counts"
          :hint="t('preferences.counts-hint')"
          :label="t('preferences.sidebar-task-counts')"
        >
          <NSwitch
            :aria-label="t('preferences.sidebar-task-counts')"
            :value="form.sidebarTaskCounts"
            @update:value="(value) => saveAppearance({ sidebarTaskCounts: value })"
          />
        </SettingsRow>
        <SettingsRow v-if="isMac" setting-key="preferences.dock-badge-speed" :label="t('preferences.dock-badge-speed')">
          <NSwitch v-model:value="form.dockBadgeSpeed" :aria-label="t('preferences.dock-badge-speed')" />
        </SettingsRow>

        <h2 class="settings-section-title">{{ t('preferences.language') }}</h2>
        <SettingsRow setting-key="preferences.select-language" :label="t('preferences.select-language')">
          <NSelect
            v-model:value="form.locale"
            :aria-label="t('preferences.select-language')"
            :options="fullLocaleOptions"
            filterable
            class="pref-control-auto"
          />
        </SettingsRow>
        <!-- Startup and window behavior -->
        <h2 class="settings-section-title">{{ t('preferences.startup-behavior') }}</h2>
        <SettingsRow setting-key="preferences.open-at-login" :label="t('preferences.open-at-login')">
          <NSwitch v-model:value="form.openAtLogin" :aria-label="t('preferences.open-at-login')" />
        </SettingsRow>
        <NCollapseTransition :show="form.openAtLogin || !!settingsRoute.hash" class="collapse-indent">
          <SettingsRow setting-key="preferences.auto-hide-window" :label="t('preferences.auto-hide-window')">
            <NSwitch v-model:value="form.autoHideWindow" :aria-label="t('preferences.auto-hide-window')" />
          </SettingsRow>
        </NCollapseTransition>
        <SettingsRow setting-key="preferences.keep-window-state" :label="t('preferences.keep-window-state')">
          <NSwitch v-model:value="form.keepWindowState" :aria-label="t('preferences.keep-window-state')" />
        </SettingsRow>
        <SettingsRow setting-key="preferences.auto-resume-all" :label="t('preferences.auto-resume-all')">
          <NSwitch v-model:value="form.resumeAllWhenAppLaunched" :aria-label="t('preferences.auto-resume-all')" />
        </SettingsRow>
        <h2 class="settings-section-title">{{ t('preferences.tray-and-dock') }}</h2>
        <SettingsRow
          setting-key="preferences.minimize-to-tray-on-close"
          :label="t('preferences.minimize-to-tray-on-close')"
        >
          <NSwitch
            v-model:value="form.minimizeToTrayOnClose"
            :aria-label="t('preferences.minimize-to-tray-on-close')"
          />
        </SettingsRow>
        <SettingsRow
          v-if="isMac"
          setting-key="preferences.hide-dock-on-minimize"
          :label="t('preferences.hide-dock-on-minimize')"
        >
          <NSwitch v-model:value="form.hideDockOnMinimize" :aria-label="t('preferences.hide-dock-on-minimize')" />
        </SettingsRow>
        <SettingsRow
          v-if="isMac || isLinux"
          setting-key="preferences.tray-speedometer"
          :label="t('preferences.tray-speedometer')"
        >
          <NSwitch v-model:value="form.traySpeedometer" :aria-label="t('preferences.tray-speedometer')" />
        </SettingsRow>
        <SettingsRow setting-key="preferences.show-progress-bar" :label="t('preferences.show-progress-bar')">
          <NSwitch v-model:value="form.showProgressBar" :aria-label="t('preferences.show-progress-bar')" />
        </SettingsRow>
        <SettingsRow setting-key="preferences.lightweight-mode">
          <template #label>
            <PreferenceHintLabel
              :label="t('preferences.lightweight-mode')"
              :hint="t('preferences.lightweight-mode-hint')"
            />
          </template>
          <NSwitch v-model:value="form.lightweightMode" :aria-label="t('preferences.lightweight-mode')" />
        </SettingsRow>
        <template v-if="appStore.updatesAvailable">
          <!-- Auto Update -->
          <h2 class="settings-section-title">{{ t('preferences.auto-update') }}</h2>
          <SettingsRow setting-key="preferences.auto-check-update" :label="t('preferences.auto-check-update')">
            <NSwitch v-model:value="form.autoCheckUpdate" :aria-label="t('preferences.auto-check-update')" />
          </SettingsRow>
          <NCollapseTransition :show="form.autoCheckUpdate || !!settingsRoute.hash" class="collapse-indent">
            <SettingsRow setting-key="preferences.check-frequency" :label="t('preferences.check-frequency')">
              <NSelect
                v-model:value="form.autoCheckUpdateInterval"
                :aria-label="t('preferences.check-frequency')"
                :options="checkIntervalOptions"
                class="pref-control-auto"
              />
            </SettingsRow>
          </NCollapseTransition>
          <SettingsRow setting-key="preferences.update-channel" :label="t('preferences.update-channel')">
            <NRadioGroup
              v-model:value="form.updateChannel"
              :aria-label="t('preferences.update-channel')"
              size="small"
              @update:value="
                async (v: string) => {
                  const ok = await preferenceStore.updateAndSave({ updateChannel: v as UpdateChannel })
                  if (ok) {
                    patchSnapshot({ updateChannel: v } as Partial<typeof form.value>)
                  }
                }
              "
            >
              <NRadioButton value="stable">{{ t('preferences.update-channel-stable') }}</NRadioButton>
              <NRadioButton value="beta">{{ t('preferences.update-channel-beta') }}</NRadioButton>
              <NRadioButton value="latest">{{ t('preferences.update-channel-latest') }}</NRadioButton>
            </NRadioGroup>
          </SettingsRow>
          <SettingsRow
            setting-key="preferences.last-check-update-time"
            :label="t('preferences.last-check-update-time')"
          >
            <div class="pref-inline-row">
              <NButton size="small" @click="handleCheckUpdate">
                <template #icon>
                  <NIcon :size="14"><CloudDownloadOutline /></NIcon>
                </template>
                {{ t('app.check-updates-now') }}
              </NButton>
              <NText v-if="preferenceStore.config.lastCheckUpdateTime" depth="3" class="pref-inline-row__meta">
                {{ new Date(preferenceStore.config.lastCheckUpdateTime).toLocaleString() }}
              </NText>
              <NText v-else depth="3" class="pref-inline-row__meta">—</NText>
            </div>
          </SettingsRow>
        </template>
      </NForm>
    </div>
    <PreferenceActionBar
      :is-saving="preferenceStore.savingChanges"
      :is-dirty="isDirty"
      @save="handleSave"
      @discard="handleReset"
    />
  </div>
</template>

<style scoped>
.custom-color-picker-wrap {
  width: 160px;
}
</style>
