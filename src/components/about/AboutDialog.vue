<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NSpin } from 'naive-ui'
import { Copy, ExternalLink } from '@lucide/vue'
import { getVersion } from '@tauri-apps/api/app'
import { arch, version } from '@tauri-apps/plugin-os'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getVersion as getEngineVersion } from '@/api/aria2'
import { usePlatform } from '@/composables/usePlatform'
import { useAppMessage } from '@/composables/useAppMessage'
import { writeAppClipboardText } from '@shared/utils'
import { logger } from '@shared/logger'
import AppDialog from '@/components/common/AppDialog.vue'
import logo from '@/assets/rayburst.svg'

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
    <div class="about-hero">
      <span class="about-rays" aria-hidden="true" />
      <img :src="logo" alt="" width="64" height="64" />
      <h2>Rayburst</h2>
      <p class="about-version">{{ appVersion }}</p>
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
      <NButton v-for="link in links" :key="link.label" quaternary size="small" @click="openUrl(link.url)"
        >{{ t(link.label)
        }}<template #icon
          ><NIcon :size="14"><ExternalLink /></NIcon></template
      ></NButton>
    </div>
    <p class="about-credit">© {{ new Date().getFullYear() }} AnInsomniacy</p>
    <template #footer
      ><NButton :disabled="loading" :aria-label="t('about.click-to-copy')" @click="copy"
        ><template #icon
          ><NIcon><Copy /></NIcon></template
        >{{ t('preferences.system-info') }}</NButton
      ><NButton type="primary" @click="$emit('close')">{{ t('app.close') }}</NButton></template
    >
  </AppDialog>
</template>

<style scoped>
.about-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 4px 0 18px;
  padding: 28px 16px 22px;
  border-radius: var(--rb-radius-card);
  overflow: hidden;
  background: linear-gradient(160deg, #2a1650 0%, #140a2c 55%, #0c0716 100%);
  color: #ffffff;
  text-align: center;
}

.about-rays {
  position: absolute;
  inset: -40% -20%;
  background:
    linear-gradient(115deg, transparent 38%, rgb(178 128 255 / 22%) 46%, transparent 54%),
    linear-gradient(135deg, transparent 52%, rgb(178 128 255 / 14%) 60%, transparent 68%),
    radial-gradient(60% 50% at 30% 10%, rgb(160 105 255 / 35%), transparent 70%);
  pointer-events: none;
}

.about-hero img {
  position: relative;
  filter: drop-shadow(0 8px 24px rgb(123 62 209 / 60%));
}

.about-hero h2 {
  position: relative;
  margin-top: 10px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.about-version {
  position: relative;
  font-size: 12px;
  color: rgb(255 255 255 / 70%);
  font-variant-numeric: tabular-nums;
}

.about-details {
  display: flex;
  flex-direction: column;
  border-radius: var(--rb-radius-tile);
  background: var(--rb-fill);
  padding: 4px 14px;
}

.about-details > div {
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 10px 0;
}

.about-details > div + div {
  border-top: 1px solid var(--rb-hairline);
}

dt {
  color: var(--rb-text-muted);
}

dd {
  text-align: end;
  font-weight: 500;
}

.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 16px 0 8px;
  margin-inline: -8px;
}

.about-credit {
  color: var(--rb-text-faint);
  font-size: 12px;
}
</style>
