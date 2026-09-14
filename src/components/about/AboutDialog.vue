<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NSpin } from 'naive-ui'
import { CopyOutline, OpenOutline } from '@vicons/ionicons5'
import { getVersion } from '@tauri-apps/api/app'
import { arch, version } from '@tauri-apps/plugin-os'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getVersion as getEngineVersion } from '@/api/aria2'
import { usePlatform } from '@/composables/usePlatform'
import { useAppMessage } from '@/composables/useAppMessage'
import { writeAppClipboardText } from '@shared/utils'
import { logger } from '@shared/logger'
import AppDialog from '@/components/common/AppDialog.vue'

const props = defineProps<{ show: boolean }>()
defineEmits<{ close: [] }>()
const { t } = useI18n()
const { platformLabel, archLabel } = usePlatform()
const message = useAppMessage()
const appVersion = ref('')
const engineVersion = ref('')
const system = ref('')
const loading = ref(false)
let generation = 0
watch(
  () => props.show,
  async (show) => {
    const current = ++generation
    if (!show) return
    loading.value = true
    try {
      appVersion.value = await getVersion()
      system.value = `${platformLabel.value} ${version()} · ${archLabel(arch())}`
      const engine = await getEngineVersion()
      if (current === generation) engineVersion.value = engine.version
    } catch (error) {
      if (current === generation) engineVersion.value = ''
      logger.debug('About.info', error)
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true },
)
const links = [
  { label: 'about.release', url: 'https://github.com/AnInsomniacy/motrix-next/releases' },
  { label: 'about.license', url: 'https://github.com/AnInsomniacy/motrix-next/blob/main/LICENSE' },
  { label: 'about.support', url: 'https://github.com/AnInsomniacy/AnInsomniacy/blob/main/SPONSOR.md' },
]
async function copy() {
  await writeAppClipboardText(`Rayburst ${appVersion.value}\nAria2 Next ${engineVersion.value}\n${system.value}`)
  message.success(t('preferences.copied-to-clipboard', { label: t('preferences.system-info') }))
}
</script>

<template>
  <AppDialog :show="show" :title="t('app.about')" size="small" :mask-closable="true" @close="$emit('close')">
    <div class="about-brand">
      <img src="@/assets/rayburst.svg" alt="" width="48" height="48" />
      <div>
        <h2>Rayburst</h2>
        <p>{{ appVersion }}</p>
      </div>
    </div>
    <dl class="about-details">
      <div>
        <dt>{{ t('about.aria2-version') }}</dt>
        <dd>
          <NSpin v-if="loading" :size="14" /><span v-else>{{ engineVersion || t('about.unavailable') }}</span>
        </dd>
      </div>
      <div>
        <dt>{{ t('preferences.system-info') }}</dt>
        <dd>{{ system }}</dd>
      </div>
    </dl>
    <div class="about-links">
      <NButton v-for="link in links" :key="link.label" text @click="openUrl(link.url)"
        >{{ t(link.label)
        }}<template #icon
          ><NIcon><OpenOutline /></NIcon></template
      ></NButton>
    </div>
    <p class="about-credit">© {{ new Date().getFullYear() }} AnInsomniacy</p>
    <template #footer
      ><NButton :disabled="loading" :aria-label="t('about.click-to-copy')" @click="copy"
        ><template #icon
          ><NIcon><CopyOutline /></NIcon></template
        >{{ t('preferences.system-info') }}</NButton
      ><NButton @click="$emit('close')">{{ t('app.close') }}</NButton></template
    >
  </AppDialog>
</template>

<style scoped>
.about-brand {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 8px 0 24px;
}
.about-brand h2 {
  font-size: 24px;
  font-weight: 600;
}
.about-brand p,
.about-credit {
  color: var(--m3-on-surface-variant);
  font-size: 13px;
}
.about-details {
  border-block: 1px solid var(--divider);
}
.about-details > div {
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 16px 0;
}
dt {
  color: var(--m3-on-surface-variant);
}
dd {
  text-align: end;
}
.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 24px 0;
}
</style>
