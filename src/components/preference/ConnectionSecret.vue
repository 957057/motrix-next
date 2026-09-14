<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput, NInputGroup, NButton, NIcon } from 'naive-ui'
import { CopyOutline, RefreshOutline, EyeOutline, EyeOffOutline } from '@vicons/ionicons5'
import { useAppMessage } from '@/composables/useAppMessage'
import { generateConfigSecret } from '@shared/utils/configHydration'
import { writeAppClipboardText } from '@shared/utils'

const value = defineModel<string>({ required: true })
const props = defineProps<{ label: string; disabled: boolean }>()
const { t } = useI18n()
const message = useAppMessage()
const revealed = ref(false)
async function copy() {
  await writeAppClipboardText(value.value)
  message.success(t('preferences.copied-to-clipboard', { label: props.label }))
}
</script>

<template>
  <NInputGroup class="connection-secret" role="group" :aria-label="label">
    <NInput
      v-model:value="value"
      :type="revealed ? 'text' : 'password'"
      :disabled="disabled"
      :status="value ? undefined : 'warning'"
      :input-props="{ 'aria-label': label, autocomplete: 'off', spellcheck: false }"
    />
    <NButton
      :disabled="disabled"
      :aria-label="t('preferences.show-secret')"
      :aria-pressed="revealed"
      :title="t('preferences.show-secret')"
      @click="revealed = !revealed"
    >
      <template #icon
        ><NIcon><component :is="revealed ? EyeOffOutline : EyeOutline" /></NIcon
      ></template>
    </NButton>
    <NButton :disabled="disabled || !value" :aria-label="t('app.menu-copy')" :title="t('app.menu-copy')" @click="copy">
      <template #icon
        ><NIcon><CopyOutline /></NIcon
      ></template>
    </NButton>
    <NButton
      :disabled="disabled"
      :aria-label="t('preferences.regenerate-secret')"
      :title="t('preferences.regenerate-secret')"
      @click="value = generateConfigSecret()"
    >
      <template #icon
        ><NIcon><RefreshOutline /></NIcon
      ></template>
    </NButton>
  </NInputGroup>
</template>

<style scoped>
.connection-secret {
  max-inline-size: 440px;
}
</style>
