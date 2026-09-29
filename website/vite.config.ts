/** @fileoverview Vite build for the static site: the page and the 404 page, locales precompiled. */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  base: '/',
  resolve: {
    alias: { '@': r('./src') },
  },
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [r('./src/locales/**')],
      strictMessage: false,
      escapeHtml: false,
    }),
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: r('./index.html'),
        notFound: r('./404.html'),
      },
      output: {
        manualChunks: {
          gsap: [
            'gsap',
            'gsap/CustomEase',
            'gsap/DrawSVGPlugin',
            'gsap/Flip',
            'gsap/MotionPathPlugin',
            'gsap/SplitText',
          ],
        },
      },
    },
  },
})
