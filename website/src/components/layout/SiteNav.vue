<script setup lang="ts">
/**
 * @fileoverview Top navigation: brand, section links (the one in view is lit),
 * language and theme menus, Sponsor, GitHub and Download. Turns solid once the
 * page leaves the top.
 */
import { useIntersectionObserver, useWindowScroll } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { computed, onMounted, ref, shallowRef, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useDownloadPulse } from '@/composables/useDownloadPulse'
import { useLanguage } from '@/composables/useLanguage'
import { useTheme, type ThemeChoice } from '@/composables/useTheme'
import { isLocale, LOCALES, systemLocale } from '@/i18n'
import { LINKS } from '@/links'
import logo from '@/assets/img/logo.svg'

const { t } = useI18n()
const { locale, switchTo } = useLanguage()
const theme = useTheme()
const pulse = useDownloadPulse()
const { y } = useWindowScroll()
const solid = computed(() => y.value > 24)

const system = systemLocale()
const themeToggle = ref<ComponentPublicInstance | null>(null)
const localeName = computed(() => (isLocale(locale.value) ? LOCALES[locale.value] : LOCALES['en-US']))
const themeIcon = computed(() => (theme.state.value === 'light' ? 'sunny-outline' : 'moon-outline'))
const THEMES: { value: ThemeChoice; icon: 'desktop-outline' | 'sunny-outline' | 'moon-outline'; key: string }[] = [
  { value: 'auto', icon: 'desktop-outline', key: 'theme.system' },
  { value: 'light', icon: 'sunny-outline', key: 'theme.light' },
  { value: 'dark', icon: 'moon-outline', key: 'theme.dark' },
]

function pickLanguage(value: unknown) {
  if (isLocale(value)) switchTo(value)
}
function pickTheme(value: unknown) {
  if (value === 'auto' || value === 'light' || value === 'dark') {
    const el: unknown = themeToggle.value?.$el
    theme.choose(value, el instanceof HTMLElement ? el.getBoundingClientRect() : undefined)
  }
}

const SECTIONS = [
  { id: 'overview', label: () => t('nav.features') },
  { id: 'connect', label: () => 'Rayburst Connect' },
  { id: 'engine', label: () => 'Aria2 Next' },
]
const current = shallowRef('')
onMounted(() => {
  for (const s of SECTIONS) {
    useIntersectionObserver(
      () => document.getElementById(s.id),
      ([entry]) => {
        if (entry?.isIntersecting) current.value = s.id
        else if (current.value === s.id) current.value = ''
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
  }
})
</script>

<template>
  <header class="nav" :class="{ 'is-solid': solid }">
    <a class="nav-brand" href="#top">
      <img :src="logo" alt="" width="28" height="28" />
      <span>Rayburst</span>
    </a>
    <nav class="nav-links" aria-label="Rayburst">
      <a v-for="s in SECTIONS" :key="s.id" :href="`#${s.id}`" :class="{ 'is-current': current === s.id }">
        {{ s.label() }}
      </a>
    </nav>
    <div class="nav-tools">
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger class="nav-tool" :aria-label="t('a11y.language')">
          <AppIcon name="language-outline" />
          <span class="nav-tool-label">{{ localeName }}</span>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="menu" align="end" :side-offset="8">
            <DropdownMenuItem class="menu-item" @select="pickLanguage(system)">
              {{ t('theme.system') }} · {{ LOCALES[system] }}
            </DropdownMenuItem>
            <DropdownMenuSeparator class="menu-sep" />
            <DropdownMenuRadioGroup :model-value="locale" @update:model-value="pickLanguage">
              <DropdownMenuRadioItem
                v-for="(name, code) in LOCALES"
                :key="code"
                class="menu-item"
                :value="code"
                :lang="code"
              >
                {{ name }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger ref="themeToggle" class="nav-tool" :aria-label="t('a11y.theme')">
          <AppIcon :name="themeIcon" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="menu" align="end" :side-offset="8">
            <DropdownMenuRadioGroup :model-value="theme.store.value" @update:model-value="pickTheme">
              <template v-for="(opt, i) in THEMES" :key="opt.value">
                <DropdownMenuRadioItem class="menu-item" :value="opt.value">
                  <AppIcon :name="opt.icon" />{{ t(opt.key) }}
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator v-if="i === 0" class="menu-sep" />
              </template>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <a
        class="nav-icon nav-heart beat-on-hover"
        :href="LINKS.sponsor"
        target="_blank"
        rel="noopener"
        :aria-label="t('hero.sponsor')"
      >
        <AppIcon name="heart-outline" class="heart" />
      </a>
      <a class="nav-icon" :href="LINKS.github" target="_blank" rel="noopener" aria-label="GitHub">
        <AppIcon name="logo-github" />
      </a>
      <a class="btn btn-primary nav-cta" href="#download" @click="pulse.request()">{{ t('nav.download') }}</a>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: fixed;
  inset: 0 0 auto;
  z-index: 50;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  gap: 24px;
  padding-inline: var(--gutter);
  border-bottom: 1px solid transparent;
  transition:
    background-color 0.4s var(--ease-enter),
    border-color 0.4s,
    backdrop-filter 0.4s;
}
.nav.is-solid {
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  border-bottom-color: var(--line);
  backdrop-filter: saturate(1.4) blur(18px);
  -webkit-backdrop-filter: saturate(1.4) blur(18px);
}
.nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.01em;
}
.nav-brand img {
  width: 28px;
  height: 28px;
  transition: transform 0.6s var(--ease-spring);
}
.nav-brand:hover img {
  transform: rotate(-8deg) scale(1.06);
}
.nav-links {
  display: flex;
  gap: 4px;
  margin-inline-start: 12px;
}
.nav-links a {
  position: relative;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  transition:
    color 0.2s,
    background-color 0.2s;
}
.nav-links a::after {
  content: '';
  position: absolute;
  inset: auto 12px 2px;
  height: 2px;
  border-radius: 2px;
  background: var(--brand);
  transform: scaleX(0);
  transition: transform 0.45s var(--ease-enter);
}
.nav-links a:hover,
.nav-links a.is-current {
  color: var(--text);
}
.nav-links a:hover {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
.nav-links a.is-current::after {
  transform: scaleX(1);
}
.nav-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
}
.nav-tool {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 10px;
  border-radius: 10px;
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  transition:
    color 0.2s,
    background-color 0.2s;
}
.nav-tool .ic {
  font-size: 18px;
}
.nav-tool:hover,
.nav-tool[data-state='open'] {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 7%, transparent);
}
.nav-icon {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: var(--text-2);
  font-size: 19px;
  transition:
    color 0.2s,
    background-color 0.2s;
}
.nav-icon:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 7%, transparent);
}
.nav-heart:hover {
  color: var(--rose);
  background: color-mix(in srgb, var(--rose) 12%, transparent);
}
.nav-cta {
  --h: 36px;
  --r: 10px;
  padding: 0 14px;
  font-size: 14px;
  margin-inline-start: 6px;
}
@media (max-width: 960px) {
  .nav-links {
    display: none;
  }
}
@media (max-width: 720px) {
  .nav-tool-label {
    display: none;
  }
}
@media (max-width: 480px) {
  .nav-cta,
  .nav-brand span {
    display: none;
  }
}
</style>
