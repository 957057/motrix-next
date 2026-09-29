<script setup lang="ts">
/**
 * @fileoverview The rename notice: a chip that unfolds into a card. Width and
 * height glide together (GSAP); the text fades in after the card starts
 * opening and fades out before it closes. A click mid-way reverses from the
 * current size.
 */
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { EASE, gsap, reducedMotion } from '@/motion/gsap'

const { t } = useI18n()
const box = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)
/** What the visitor asked for (chevron, aria-expanded). */
const expanded = ref(false)
/** Whether the open layout is in place (stays true while the card closes). */
const shown = ref(false)
let anim: gsap.core.Timeline | null = null

/** Natural size of the box in the open or closed layout, measured without a paint. */
function measure(el: HTMLElement, text: HTMLElement, open: boolean) {
  const saved = {
    width: el.style.width,
    height: el.style.height,
    display: text.style.display,
    open: el.classList.contains('is-open'),
  }
  el.style.width = ''
  el.style.height = ''
  el.classList.toggle('is-open', open)
  text.style.display = open ? '' : 'none'
  const r = el.getBoundingClientRect()
  el.style.width = saved.width
  el.style.height = saved.height
  el.classList.toggle('is-open', saved.open)
  text.style.display = saved.display
  return { width: r.width, height: r.height }
}

async function toggle() {
  const el = box.value
  const text = body.value
  const open = !expanded.value
  expanded.value = open
  if (!el || !text || reducedMotion()) {
    shown.value = open
    return
  }
  anim?.kill()
  const from = el.getBoundingClientRect()
  const to = measure(el, text, open)
  if (open) {
    shown.value = true
    await nextTick()
    anim = gsap
      .timeline({ onComplete: () => void gsap.set(el, { clearProps: 'width,height' }) })
      .fromTo(el, { width: from.width, height: from.height }, { ...to, duration: 0.7, ease: EASE.enter })
      .fromTo(text, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE.enter }, 0.15)
  } else {
    anim = gsap
      .timeline({
        onComplete: () => {
          shown.value = false
          gsap.set(el, { clearProps: 'width,height' })
          gsap.set(text, { clearProps: 'opacity,visibility,transform' })
        },
      })
      .to(text, { autoAlpha: 0, y: -4, duration: 0.2, ease: EASE.exit })
      .fromTo(el, { width: from.width, height: from.height }, { ...to, duration: 0.55, ease: 'power3.inOut' }, 0.08)
  }
}

onBeforeUnmount(() => anim?.kill())
</script>

<template>
  <div ref="box" class="migrate" :class="{ 'is-open': shown }">
    <button class="migrate-head" type="button" :aria-expanded="expanded" aria-controls="migrate-body" @click="toggle">
      <span class="migrate-dot">Motrix Next</span>
      <span>{{ t('rebrand.chip') }}</span>
      <AppIcon name="chevron-down-outline" :class="{ 'is-open': expanded }" />
    </button>
    <div v-show="shown" id="migrate-body" ref="body" class="migrate-body">
      <p>{{ t('rebrand.body') }}</p>
    </div>
  </div>
</template>

<style scoped>
.migrate {
  position: relative;
  z-index: 2;
  width: fit-content;
  max-width: 100%;
  border-radius: 20px;
  overflow: hidden;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  border: 1px solid var(--line-2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 14px;
  transition:
    background-color 0.3s,
    border-color 0.3s;
}
.migrate.is-open {
  width: min(560px, 100%);
  background: color-mix(in srgb, var(--text) 7%, transparent);
}
.migrate-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 14px 7px 10px;
  color: var(--text-2);
  font-size: 14px;
  white-space: nowrap;
  transition: color 0.2s;
}
.migrate-head:hover {
  color: var(--text);
}
.migrate-dot {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--brand);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.migrate-head .ic {
  margin-inline-start: auto;
  font-size: 14px;
  transition: transform 0.5s var(--ease-enter);
}
.migrate-head .ic.is-open {
  transform: rotate(180deg);
}
.migrate-body p {
  /* The text keeps its open width while the card widens, so it never reflows. */
  width: min(558px, 100vw - 2 * var(--gutter));
  margin: 0;
  padding: 0 16px 14px;
  color: var(--text-2);
  text-align: start;
  line-height: 1.55;
}
</style>
