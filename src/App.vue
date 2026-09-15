<script setup lang="ts">
/** @fileoverview Root component: theme, locale and motion configuration providers. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  type NLocale,
  type NDateLocale,
  zhCN,
  zhTW,
  jaJP,
  koKR,
  ruRU,
  frFR,
  deDE,
  esAR,
  ptBR,
  itIT,
  trTR,
  idID,
  viVN,
  plPL,
  thTH,
  arDZ,
  ukUA,
  nlNL,
  nbNO,
  dateZhCN,
  dateZhTW,
  dateJaJP,
  dateKoKR,
  dateRuRU,
  dateFrFR,
  dateDeDE,
  dateEsAR,
  datePtBR,
  dateItIT,
  dateTrTR,
  dateIdID,
  dateViVN,
  datePlPL,
  dateThTH,
  dateArDZ,
  dateUkUA,
  dateNlNL,
  dateNbNO,
} from 'naive-ui'
import { MotionConfig } from 'motion-v'
import { useInterfaceDirection } from './composables/useInterfaceDirection'
import { provideAppTheme } from './composables/useAppTheme'
import { useReducedMotion, useReducedMotionClass } from './composables/useReducedMotion'
import { useVisibilityPause } from './composables/useVisibilityPause'
import { isSupportedLocale, type SupportedLocale } from '@shared/localeCatalog'

const { locale: currentLocale } = useI18n()
const { naiveTheme, naiveOverrides } = provideAppTheme()
useVisibilityPause()
useReducedMotionClass()
const reduceMotion = useReducedMotion()
const rtl = useInterfaceDirection()

const naiveLocaleMap: Partial<Record<SupportedLocale, NLocale>> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja: jaJP,
  ko: koKR,
  ru: ruRU,
  fr: frFR,
  de: deDE,
  es: esAR,
  'pt-BR': ptBR,
  it: itIT,
  tr: trTR,
  id: idID,
  vi: viVN,
  pl: plPL,
  th: thTH,
  ar: arDZ,
  uk: ukUA,
  nl: nlNL,
  nb: nbNO,
}
const naiveDateLocaleMap: Partial<Record<SupportedLocale, NDateLocale>> = {
  'zh-CN': dateZhCN,
  'zh-TW': dateZhTW,
  ja: dateJaJP,
  ko: dateKoKR,
  ru: dateRuRU,
  fr: dateFrFR,
  de: dateDeDE,
  es: dateEsAR,
  'pt-BR': datePtBR,
  it: dateItIT,
  tr: dateTrTR,
  id: dateIdID,
  vi: dateViVN,
  pl: datePlPL,
  th: dateThTH,
  ar: dateArDZ,
  uk: dateUkUA,
  nl: dateNlNL,
  nb: dateNbNO,
}

const naiveLocale = computed(() =>
  isSupportedLocale(currentLocale.value) ? naiveLocaleMap[currentLocale.value] || null : null,
)
const naiveDateLocale = computed(() =>
  isSupportedLocale(currentLocale.value) ? naiveDateLocaleMap[currentLocale.value] || null : null,
)
const motionTransition = computed(() =>
  reduceMotion.value ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 42, mass: 1 },
)
</script>

<template>
  <NConfigProvider
    :theme="naiveTheme"
    :rtl="rtl"
    :theme-overrides="naiveOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <NMessageProvider placement="bottom">
      <NDialogProvider>
        <MotionConfig :reduced-motion="reduceMotion ? 'always' : 'user'" :transition="motionTransition">
          <router-view />
        </MotionConfig>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
#app {
  height: 100%;
}
</style>
