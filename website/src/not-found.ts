/** @fileoverview 404 entry: the same fonts, tokens and language detection as the page. */
import '@fontsource-variable/inter'
import './styles/tokens.css'
import './styles/base.css'
import './styles/controls.css'
import { createApp } from 'vue'
import NotFound from './NotFound.vue'
import { detectLocale, i18n, setLocale } from './i18n'

await setLocale(detectLocale(), false)
createApp(NotFound).use(i18n).mount('#app')
