<script setup lang="ts">
/**
 * @fileoverview The English film in a dialog, using YouTube's privacy-enhanced
 * player. No YouTube resources load until the dialog opens; closing it
 * removes the player and stops playback.
 */
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { LINKS } from '@/links'

const open = defineModel<boolean>('open', { required: true })
const { t, locale } = useI18n()

const videoId = new URL(LINKS.film).searchParams.get('v') ?? ''
const src = computed(() => {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
  url.search = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', hl: locale.value }).toString()
  return url.href
})
const title = computed(() => `${t('film.watch')} · ${t('film.language')}`)
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="film-overlay" />
      <DialogContent class="film" :aria-describedby="undefined">
        <DialogTitle class="sr-only">{{ title }}</DialogTitle>
        <DialogClose class="film-close" :aria-label="t('film.close')">
          <AppIcon name="close-outline" />
        </DialogClose>
        <div class="film-stage">
          <iframe
            v-if="open"
            :src="src"
            :title="title"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p class="film-help">
          <span>{{ t('film.help') }}</span>
          {{ ' ' }}
          <a :href="LINKS.film" target="_blank" rel="noopener">{{ t('film.youtube') }}</a>
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.film-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(6, 4, 10, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.film-overlay[data-state='open'] {
  animation: film-fade 0.35s var(--ease-enter);
}
.film-overlay[data-state='closed'] {
  animation: film-fade 0.2s var(--ease-exit) reverse forwards;
}
.film {
  position: fixed;
  inset: 0;
  z-index: 71;
  display: grid;
  place-content: center;
  padding: var(--gutter);
  color: #fff;
  outline: none;
}
.film-stage {
  width: min(calc(100vw - 2 * var(--gutter)), 1280px, calc((100svh - 120px) * 16 / 9));
  min-width: min(100%, 200px);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 18px;
  background: #0b0910;
  box-shadow: var(--shadow);
}
.film[data-state='open'] .film-stage {
  animation: film-pop 0.4s var(--ease-enter);
}
.film[data-state='closed'] {
  animation: film-fade 0.2s var(--ease-exit) reverse forwards;
}
.film-stage iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
.film-help {
  margin: 16px 0 0;
  text-align: center;
  font-size: 14px;
}
.film-help a {
  text-decoration: underline;
}
.film-close {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 20px;
  transition:
    background-color 0.2s,
    transform 0.35s var(--ease-spring);
}
.film-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}
@keyframes film-fade {
  from {
    opacity: 0;
  }
}
@keyframes film-pop {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.94);
  }
}
</style>
