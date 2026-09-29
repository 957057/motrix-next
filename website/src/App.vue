<script setup lang="ts">
/** @fileoverview The page: navigation, the sections in reading order, the footer and the film. */
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import ConnectSection from '@/components/connect/ConnectSection.vue'
import CraftSection from '@/components/craft/CraftSection.vue'
import DetailsSection from '@/components/details/DetailsSection.vue'
import DownloadSection from '@/components/download/DownloadSection.vue'
import EngineSection from '@/components/engine/EngineSection.vue'
import HeroSection from '@/components/hero/HeroSection.vue'
import FilmDialog from '@/components/layout/FilmDialog.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteNav from '@/components/layout/SiteNav.vue'
import OverviewSection from '@/components/sections/OverviewSection.vue'
import ProtocolsSection from '@/components/sections/ProtocolsSection.vue'
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
useTheme()
const film = ref(false)

watchEffect(() => {
  document.title = `Rayburst — ${t('hero.tagline')}`
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('hero.description'))
})
</script>

<template>
  <SiteNav />
  <main id="top">
    <HeroSection @film="film = true" />
    <OverviewSection />
    <ProtocolsSection />
    <DetailsSection />
    <ConnectSection />
    <EngineSection />
    <CraftSection />
    <DownloadSection />
  </main>
  <SiteFooter />
  <FilmDialog v-model:open="film" />
</template>
