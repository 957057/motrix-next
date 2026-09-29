<script setup lang="ts">
/**
 * @fileoverview The first screen. The logo traces itself and fills in, the
 * name rises letter by letter, then the slogan, actions, film card and
 * statistics follow. One GSAP timeline plays the intro once the fonts are in;
 * the sky behind it runs on its own scene clock.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useDownloadPulse } from '@/composables/useDownloadPulse'
import { useStats } from '@/composables/useStats'
import { LINKS } from '@/links'
import { EASE, gsap, reducedMotion, SplitText } from '@/motion/gsap'
import { useScene } from '@/motion/useScene'
import filmCover from '@/assets/img/film-cover.webp'
import HeroLogo from './HeroLogo.vue'
import HeroSky from './HeroSky.vue'
import MigrateNote from './MigrateNote.vue'

const emit = defineEmits<{ film: [] }>()
const { t } = useI18n()
const stats = useStats()
const pulse = useDownloadPulse()

const root = ref<HTMLElement | null>(null)
const logo = ref<InstanceType<typeof HeroLogo> | null>(null)
const logoEl = ref<HTMLElement | null>(null)
const title = ref<HTMLElement | null>(null)
const sky = useScene(root, { still: 3, autostart: false })

function openFilm(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  emit('film')
}

// ── Intro ────────────────────────────────────────────────────────────────
let intro: gsap.core.Timeline | null = null
let split: SplitText | null = null

onMounted(async () => {
  const el = root.value
  if (!el || !title.value) return
  const rise = el.querySelectorAll('[data-intro]')
  if (reducedMotion()) {
    sky.play()
    return
  }
  split = SplitText.create(title.value, { type: 'chars', charsClass: 'ch' })
  title.value.classList.add('is-split')
  gsap.set(rise, { autoAlpha: 0, y: 18 })
  gsap.set(split.chars, { autoAlpha: 0, yPercent: 35, filter: 'blur(10px)' })
  const logoIntro = logo.value?.intro()
  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 700))])
  intro = gsap.timeline({ defaults: { ease: EASE.text, duration: 0.9 } })
  if (logoIntro) intro.add(logoIntro, 0)
  intro
    .to(split.chars, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', stagger: 0.045, clearProps: 'filter' }, 0.55)
    .to(rise, { autoAlpha: 1, y: 0, stagger: 0.07, clearProps: 'transform' }, 0.95)
  sky.play()
})

onBeforeUnmount(() => {
  intro?.kill()
  split?.revert()
})
</script>

<template>
  <section id="hero" ref="root" class="hero">
    <div class="hero-sky" aria-hidden="true" />
    <HeroSky :time="sky.time.value" :logo="logoEl" />
    <div class="hero-copy wrap">
      <MigrateNote class="hero-migrate" data-intro />

      <div ref="logoEl" class="hero-logo-box"><HeroLogo ref="logo" /></div>

      <h1 ref="title" class="hero-title">Rayburst</h1>
      <p class="hero-tagline" data-intro>{{ t('hero.tagline') }}</p>
      <p class="hero-desc" data-intro>{{ t('hero.description') }}</p>
      <div class="hero-actions" data-intro>
        <a class="btn btn-sponsor btn-lg" :href="LINKS.sponsor" target="_blank" rel="noopener">
          <AppIcon name="heart" class="heart" />
          <span>{{ t('hero.sponsor') }}</span>
        </a>
        <a class="btn btn-primary btn-lg" href="#download" @click="pulse.request()">
          <AppIcon name="download-outline" />
          <span>{{ t('hero.download') }}</span>
        </a>
        <a class="btn btn-glass btn-lg" :href="LINKS.github" target="_blank" rel="noopener">
          <AppIcon name="logo-github" />
          <span>{{ t('hero.github') }}</span>
        </a>
      </div>
      <a class="film-card" :href="LINKS.film" data-intro @click="openFilm">
        <span class="film-thumb" aria-hidden="true">
          <img :src="filmCover" alt="" width="384" height="216" />
          <i class="film-thumb-play"><AppIcon name="play" /></i>
        </span>
        <span class="film-text">
          <b>{{ t('film.watch') }}</b>
          <small class="mono film-meta"><bdi>1:06</bdi> · {{ t('film.language') }}</small>
        </span>
      </a>
      <div class="hero-meta" data-intro>
        <a class="stat" :href="LINKS.stars" target="_blank" rel="noopener">
          <AppIcon name="star-outline" /><b>{{ stats.stars.value }}</b
          ><span>{{ t('hero.stars') }}</span>
        </a>
        <i class="stat-sep" />
        <a class="stat" :href="LINKS.releases" target="_blank" rel="noopener">
          <AppIcon name="download-outline" /><b>{{ stats.downloads.value }}</b
          ><span>{{ t('hero.downloads') }}</span>
        </a>
        <i class="stat-sep" />
        <a class="stat" :href="LINKS.latest" target="_blank" rel="noopener">
          <AppIcon name="pricetag-outline" /><b>{{ stats.version.value }}</b
          ><span>{{ t('hero.version') }}</span>
        </a>
      </div>
    </div>
    <a class="hero-scroll" href="#overview" :aria-label="t('nav.features')" data-intro>
      <AppIcon name="chevron-down-outline" />
    </a>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
  padding-top: calc(var(--nav-h) + clamp(32px, 6vh, 72px));
  padding-bottom: clamp(64px, 10vh, 104px);
  isolation: isolate;
  overflow-x: clip;
}
.hero-sky {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(60% 50% at 50% 0%, var(--glow-a), transparent 70%),
    radial-gradient(40% 40% at 85% 30%, var(--glow-b), transparent 70%),
    radial-gradient(40% 40% at 10% 40%, color-mix(in srgb, var(--glow-a) 60%, transparent), transparent 70%);
  animation: sky-in 1.6s 0.1s var(--ease-text) both;
}
.hero-sky::after {
  content: '';
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from var(--sky-turn, 0deg) at 50% 18%,
    transparent 0deg,
    color-mix(in srgb, var(--accent-2) 10%, transparent) 40deg,
    transparent 90deg,
    color-mix(in srgb, var(--glow-b) 70%, transparent) 200deg,
    transparent 260deg
  );
  mask-image: radial-gradient(70% 60% at 50% 20%, #000, transparent 75%);
  -webkit-mask-image: radial-gradient(70% 60% at 50% 20%, #000, transparent 75%);
  animation: sky-turn 40s linear infinite;
}
@property --sky-turn {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes sky-turn {
  to {
    --sky-turn: 360deg;
  }
}
@keyframes sky-in {
  from {
    opacity: 0;
  }
}
.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-migrate {
  margin-bottom: clamp(28px, 5vh, 44px);
}

.hero-logo-box {
  width: clamp(84px, 11vw, 124px);
  margin-bottom: 18px;
}
.hero-title {
  margin: 0;
  font-size: clamp(64px, 11vw, 148px);
  line-height: 0.95;
  font-weight: 800;
  letter-spacing: -0.055em;
  padding-bottom: 0.08em;
}
.hero-title:not(.is-split) {
  background: var(--sheen);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
/* Each letter carries the gradient itself once split: clipping text to a
   parent's background does not survive transformed children. */
.hero-title :deep(.ch) {
  background: var(--sheen);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding-bottom: 0.08em;
}
.hero-tagline {
  margin: 18px 0 0;
  font-size: clamp(20px, 2.6vw, 32px);
  line-height: 1.25;
  font-weight: 650;
  letter-spacing: -0.02em;
  background: var(--brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-wrap: balance;
}
.hero-desc {
  margin: 14px 0 0;
  max-width: 560px;
  color: var(--text-2);
  font-size: clamp(16px, 1.5vw, 19px);
  text-wrap: balance;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 34px;
}
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px 22px;
  margin-top: 18px;
  color: var(--text-3);
  font-size: 14px;
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: color 0.2s;
}
.stat:hover {
  color: var(--text);
}
.stat .ic {
  font-size: 15px;
}
.stat b {
  color: var(--text);
  font-family: var(--mono);
  font-weight: 600;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.stat-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-3);
  opacity: 0.6;
}

/* Film link: local cover, official player on demand. */
.film-card {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  margin-top: 22px;
  padding: 6px 20px 6px 6px;
  border-radius: 16px;
  color: var(--text);
  text-align: start;
  transition: background-color 0.3s;
}
.film-card:hover {
  background: color-mix(in srgb, var(--text) 5%, transparent);
}
.film-thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 96px;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(140deg, #22163a, #0b0914);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.12),
    0 10px 26px -10px rgba(123, 62, 209, 0.75);
  transition: transform 0.45s var(--ease-spring);
}
.film-thumb > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.film-thumb-play {
  position: relative;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #5a2da8;
  font-size: 11px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  transition: transform 0.45s var(--ease-spring);
}
.film-thumb-play .ic {
  margin-inline-start: 2px;
}
.film-card:hover .film-thumb {
  transform: scale(1.04);
}
.film-card:hover .film-thumb-play {
  transform: scale(1.15);
}
.film-text {
  display: grid;
  gap: 2px;
  line-height: 1.25;
}
.film-text b {
  font-size: 15px;
  font-weight: 600;
}
.film-meta {
  color: var(--text-3);
  font-size: 12px;
}

/* A quiet hint that the page continues. */
.hero-scroll {
  position: absolute;
  left: 50%;
  bottom: 22px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-left: -18px;
  border-radius: 50%;
  color: var(--text-3);
  font-size: 20px;
  transition: color 0.2s;
}
.hero-scroll:hover {
  color: var(--text);
}
.hero-scroll .ic {
  animation: nudge 2.4s var(--ease-enter) infinite;
}
@keyframes nudge {
  0%,
  60%,
  100% {
    transform: none;
  }
  30% {
    transform: translateY(5px);
  }
}
@media (max-height: 760px) {
  .hero-scroll {
    display: none;
  }
}
@media (max-width: 560px) {
  .hero-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    max-width: 400px;
  }
  .hero-actions .btn-primary {
    grid-column: 1 / -1;
    order: -1;
  }
  .hero-actions .btn {
    padding-inline: 16px;
  }
}
</style>
