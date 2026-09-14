<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke } from '@tauri-apps/api/core'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NInputGroup,
  NSwitch,
  NButton,
  NDivider,
  NIcon,
  NCollapseTransition,
  useDialog,
} from 'naive-ui'
import { CopyOutline, DiceOutline } from '@vicons/ionicons5'
import { usePreferenceStore } from '@/stores/preference'
import { usePreferenceForm } from '@/composables/usePreferenceForm'
import { usePreferenceNumericValidation } from '@/composables/usePreferenceNumericValidation'
import { useAppMessage } from '@/composables/useAppMessage'
import { generateConfigSecret } from '@shared/utils/configHydration'
import { writeAppClipboardText } from '@shared/utils'
import PreferenceHintLabel from '@/components/preference/PreferenceHintLabel.vue'
import PreferenceActionBar from '@/components/preference/PreferenceActionBar.vue'

const { t } = useI18n()
const preferences = usePreferenceStore()
const dialog = useDialog()
const message = useAppMessage()
const { constraint, configFieldProps, areConfigFieldsValid } = usePreferenceNumericValidation()
const { form, isDirty, handleSave, handleReset } = usePreferenceForm({
  buildForm: () => ({
    extensionApiPort: preferences.config.extensionApiPort,
    extensionApiSecret: preferences.config.extensionApiSecret,
    autoSubmitFromExtension: preferences.config.autoSubmitFromExtension,
    silentAutoSubmitFromExtension: preferences.config.silentAutoSubmitFromExtension,
  }),
  beforeSave: async (candidate) => {
    if (candidate.extensionApiPort === preferences.config.extensionApiPort) return true
    return new Promise<boolean>((resolve) =>
      dialog.warning({
        title: t('preferences.extension-api-port'),
        content: t('preferences.extension-api-port-confirm', { port: candidate.extensionApiPort }),
        positiveText: t('app.confirm'),
        negativeText: t('app.cancel'),
        maskClosable: false,
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
      }),
    )
  },
  afterSave: async (candidate, previous) => {
    if (candidate.extensionApiPort === previous.extensionApiPort) return
    try {
      const appliedPort = await invoke<number>('restart_http_api', { port: candidate.extensionApiPort })
      if (appliedPort !== candidate.extensionApiPort) await preferences.updateAndSave({ extensionApiPort: appliedPort })
      message.success(t('preferences.extension-api-port-applied', { port: appliedPort }))
    } catch (error) {
      await invoke('restart_http_api', { port: previous.extensionApiPort })
      throw error
    }
  },
})
const valid = computed(() => areConfigFieldsValid({ extensionApiPort: form.value.extensionApiPort }))
async function copySecret() {
  await writeAppClipboardText(form.value.extensionApiSecret)
  message.success(t('task.copy-link-success'))
}
</script>
<template>
  <section class="connection-view">
    <header>
      <h1>{{ t('workspace.browser-connection') }}</h1>
    </header>
    <div class="preference-form-wrapper">
      <div class="preference-form-scroll">
        <NForm label-placement="left" label-align="left" label-width="260px" class="form-preference">
          <NDivider title-placement="left">{{ t('preferences.extension-section') }}</NDivider>
          <NFormItem :label="t('preferences.auto-submit-from-extension')">
            <NSwitch v-model:value="form.autoSubmitFromExtension" />
          </NFormItem>
          <NCollapseTransition :show="form.autoSubmitFromExtension" class="collapse-indent">
            <NFormItem :label="t('preferences.silent-auto-submit-from-extension')">
              <NSwitch v-model:value="form.silentAutoSubmitFromExtension" />
            </NFormItem>
          </NCollapseTransition>
          <NFormItem
            :label="t('preferences.extension-api-port')"
            v-bind="configFieldProps('extensionApiPort', form.extensionApiPort)"
          >
            <NInputNumber
              v-model:value="form.extensionApiPort"
              :min="constraint('extensionApiPort').min"
              :max="constraint('extensionApiPort').max"
              class="pref-port"
            />
          </NFormItem>
          <NFormItem :validation-status="form.extensionApiSecret ? undefined : 'warning'">
            <template #label>
              <PreferenceHintLabel
                :label="t('preferences.extension-api-secret')"
                :hint="t('preferences.extension-api-secret-tip')"
              />
            </template>
            <NInputGroup>
              <NInput
                v-model:value="form.extensionApiSecret"
                type="password"
                show-password-on="click"
                :placeholder="t('preferences.extension-api-secret')"
                class="pref-control-full"
                :status="form.extensionApiSecret ? undefined : 'warning'"
              />
              <NButton class="pref-icon-button" @click="copySecret()">
                <template #icon>
                  <NIcon :size="14"><CopyOutline /></NIcon>
                </template>
              </NButton>
              <NButton class="pref-icon-button" @click="form.extensionApiSecret = generateConfigSecret()">
                <template #icon>
                  <NIcon :size="14"><DiceOutline /></NIcon>
                </template>
              </NButton>
            </NInputGroup>
          </NFormItem>
        </NForm>
      </div>
      <PreferenceActionBar :is-dirty="isDirty" :is-valid="valid" @save="handleSave" @discard="handleReset" />
    </div>
  </section>
</template>
<style scoped>
.connection-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
header {
  padding: 16px 24px 20px;
}
h1 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.preference-form-wrapper {
  flex: 1;
  min-height: 0;
}
</style>
