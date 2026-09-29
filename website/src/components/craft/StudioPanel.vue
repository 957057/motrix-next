<script setup lang="ts">
/**
 * @fileoverview A studio around one live Rayburst window. The visitor picks
 * light or dark, one of the ten color schemes (palettes generated like
 * colorScheme.ts) and any of the 27 languages the app ships; the window
 * follows at once. Until the first pick, a slow tour changes one thing at a
 * time.
 */
import { RadioGroupItem, RadioGroupRoot, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import RbWindow from '@/components/mock/RbWindow.vue'
import { useTheme } from '@/composables/useTheme'
import { isLocale, loadLocale, LOCALES, translatorFor, type Locale } from '@/i18n'
import { vReveal } from '@/motion/directives'
import { EASE, gsap } from '@/motion/gsap'
import { useScene } from '@/motion/useScene'
import { KINDS, scenario, toastsFor } from '@/sim/tasks'
import { SCHEMES as schemes, type SchemeTokens } from '@/data/schemes'

type Look = 'light' | 'dark'

/** Languages the tour visits, one per step. */
const TOUR: Locale[] = ['ja', 'de', 'ar', 'fr', 'ko', 'es', 'ru', 'hi', 'zh-CN', 'pt-BR', 'th', 'it']
const STEP = 2.6

const { t, locale } = useI18n()
const theme = useTheme()

const manual = ref(false)
const look = ref<Look>(theme.state.value)
const scheme = ref(0)
const lang = ref<Locale>(isLocale(locale.value) ? locale.value : 'en-US')
const tr = computed(() => translatorFor(lang.value))

// Until the visitor picks something, the window follows the page's theme and language.
watch(theme.state, (state) => {
  if (!manual.value) look.value = state
})
watch(locale, (code) => {
  if (!manual.value && isLocale(code)) lang.value = code
})

/** Map generated tokens onto the window's roles (sidebar, list, cards). */
function schemeVars(tok: SchemeTokens, dark: boolean): Record<string, string> {
  return {
    '--w-text': tok.text,
    '--w-dim': tok.textDim,
    '--w-outline': tok.outline,
    '--w-ov': tok.outlineVariant,
    '--w-primary': tok.primary,
    '--w-on-primary': tok.onPrimary,
    '--w-info': tok.info,
    '--w-success': tok.success,
    '--w-highest': tok.highest,
    '--w-high': tok.high,
    '--w-side': dark ? tok.low : tok.container,
    '--w-main': dark ? tok.high : tok.low,
    '--w-item': dark ? tok.container : tok.lowest,
  }
}
const vars = computed(() => schemeVars(schemes[scheme.value][look.value], look.value === 'dark'))
const schemeName = computed(() => t(`scheme.${schemes[scheme.value].id}`))

// The window's labels change language in place; a short fade marks the switch.
const stageEl = ref<HTMLElement | null>(null)
async function showLanguage(code: Locale) {
  await loadLocale(code)
  lang.value = code
  if (stageEl.value) {
    gsap.fromTo(
      stageEl.value,
      { opacity: 0.55, filter: 'blur(2px)' },
      { opacity: 1, filter: 'blur(0px)', duration: 0.38, ease: EASE.enter, clearProps: 'filter,opacity' },
    )
  }
}

function pickLook(value: unknown) {
  if (value !== 'light' && value !== 'dark') return
  manual.value = true
  look.value = value
}
function pickScheme(value: unknown) {
  manual.value = true
  scheme.value = Number(value)
}
function pickLanguage(value: unknown) {
  if (!isLocale(value)) return
  manual.value = true
  showLanguage(value)
}

const model = scenario(
  [KINDS.live(-50, 3120), KINDS.sftp(-30, 0.62), KINDS.bt(-4, 0.3, 30, 0.8), KINDS.http(0, 0.2), KINDS.media(0, 0.44)],
  { newestFirst: true },
)
const studio = ref<HTMLElement | null>(null)
const scene = useScene(studio, { still: 8 })
const frame = computed(() => model(scene.time.value, tr.value))
const toasts = computed(() => toastsFor(frame.value, scene.time.value, tr.value))

// The tour: every step changes one thing (scheme, language, then appearance).
watch(
  () => Math.floor(scene.time.value / STEP),
  (k) => {
    if (manual.value || scene.reduced.value || k === 0) return
    const phase = k % 4
    if (phase === 1 || phase === 3) scheme.value = (scheme.value + 1) % schemes.length
    else if (phase === 2) showLanguage(TOUR[Math.floor(k / 4) % TOUR.length])
    else look.value = look.value === 'dark' ? 'light' : 'dark'
  },
)
</script>

<template>
  <div ref="studio" v-reveal.scale="2" class="studio" :class="{ 'is-manual': manual }">
    <div ref="stageEl" class="studio-stage">
      <RbWindow
        :frame="frame"
        :toasts="toasts"
        :tr="tr"
        :height="620"
        :rows="4"
        :wide-from="620"
        :data-look="look"
        :style="vars"
      />
    </div>
    <div class="studio-panel">
      <div class="ctl">
        <span class="ctl-label">{{ t('craft.appearance') }}</span>
        <ToggleGroupRoot
          type="single"
          class="seg"
          :model-value="look"
          :aria-label="t('craft.appearance')"
          :style="{ '--at': look === 'light' ? 0 : 1 }"
          @update:model-value="pickLook"
        >
          <i class="seg-thumb" aria-hidden="true" />
          <ToggleGroupItem value="light"
            ><AppIcon name="sunny-outline" /><span>{{ t('theme.light') }}</span></ToggleGroupItem
          >
          <ToggleGroupItem value="dark"
            ><AppIcon name="moon-outline" /><span>{{ t('theme.dark') }}</span></ToggleGroupItem
          >
        </ToggleGroupRoot>
      </div>
      <div class="ctl">
        <span class="ctl-label"
          ><span>{{ t('craft.scheme') }}</span
          ><b>{{ schemeName }}</b></span
        >
        <RadioGroupRoot
          class="swatches"
          :model-value="String(scheme)"
          :aria-label="t('craft.scheme')"
          orientation="horizontal"
          @update:model-value="pickScheme"
        >
          <RadioGroupItem
            v-for="(s, i) in schemes"
            :key="s.id"
            class="swatch"
            :value="String(i)"
            :title="t(`scheme.${s.id}`)"
            :style="{ '--s': s.seed }"
          >
            <i />
          </RadioGroupItem>
        </RadioGroupRoot>
      </div>
      <div class="ctl ctl-grow">
        <span class="ctl-label"
          ><span>{{ t('a11y.language') }}</span
          ><b>{{ LOCALES[lang] }}</b></span
        >
        <RadioGroupRoot
          class="lang-chips"
          :model-value="lang"
          :aria-label="t('a11y.language')"
          @update:model-value="pickLanguage"
        >
          <RadioGroupItem v-for="(name, code) in LOCALES" :key="code" class="lang-chip" :value="code" :lang="code">
            {{ name }}
          </RadioGroupItem>
        </RadioGroupRoot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: clamp(20px, 3vw, 36px);
  padding: clamp(16px, 2.4vw, 28px);
  border-radius: 30px;
  border: 1px solid var(--line);
  background:
    radial-gradient(60% 80% at 30% 0%, color-mix(in srgb, var(--accent-2) 14%, transparent), transparent 70%),
    var(--card);
}
.studio-stage {
  display: grid;
  align-items: center;
  min-width: 0;
}
/* Scheme, appearance and language changes glide instead of snapping. */
.studio-stage :deep(.rbw-win),
.studio-stage :deep(.rbw-win *) {
  transition:
    background-color 0.45s var(--ease-enter),
    border-color 0.45s var(--ease-enter),
    color 0.45s var(--ease-enter),
    fill 0.45s var(--ease-enter);
}
.studio-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
}
.ctl {
  display: grid;
  gap: 12px;
}
.ctl-grow {
  flex: 1 1 0;
  min-height: 160px;
  grid-template-rows: auto minmax(0, 1fr);
}
.ctl-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ctl-label b {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}
.seg {
  width: 100%;
}
.seg :deep(button) {
  min-width: 0;
}
.swatches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px 8px;
}
.swatch {
  display: grid;
  justify-items: center;
}
.swatch i {
  display: block;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--s);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.15),
    0 0 0 0 var(--s);
  transition:
    box-shadow 0.35s var(--ease-enter),
    transform 0.35s var(--ease-spring);
}
.swatch:hover i {
  transform: scale(1.08);
}
.swatch[data-state='checked'] i {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.2),
    0 0 0 3px var(--card),
    0 0 0 5px var(--s);
}
.lang-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 6px;
  min-height: 0;
  overflow: auto;
  padding: 2px 6px 16px 2px;
  scrollbar-width: thin;
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 28px), transparent);
  mask-image: linear-gradient(180deg, #000 calc(100% - 28px), transparent);
}
.lang-chip {
  overflow: hidden;
  height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  color: var(--text-2);
  font-size: 13px;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background-color 0.25s,
    color 0.25s,
    box-shadow 0.25s;
}
.lang-chip:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
.lang-chip[data-state='checked'] {
  color: var(--text);
  background: color-mix(in srgb, var(--accent-2) 20%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-2) 50%, transparent);
}
@media (max-width: 960px) {
  .studio {
    grid-template-columns: 1fr;
  }
  .ctl-grow {
    flex: none;
  }
  .lang-chips {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    max-height: 220px;
  }
}
</style>
