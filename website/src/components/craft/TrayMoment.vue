<script setup lang="ts">
/**
 * @fileoverview The menu bar: Rayburst's tray title shows live speed
 * (stat.rs, tray_title_for_speed) and its menu opens and walks its entries
 * (tray.rs).
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { noise } from '@/motion/gsap'
import { useScene } from '@/motion/useScene'
import { compactSpeed, MB } from '@/sim/format'
import logo from '@/assets/img/logo.svg'

const { t } = useI18n()
const ENTRIES = [['tray.show'], ['tray.new', 'tray.resume', 'tray.pause'], ['tray.quit']]
const FLAT = ENTRIES.flat()

const box = ref<HTMLElement | null>(null)
const { time } = useScene(box, { loop: 8, still: 3.4 })
const title = computed(() => compactSpeed((37.8 + 6 * noise(time.value * 0.7, 3)) * MB))
const open = computed(() => time.value > 2.2 && time.value < 6.4)
const hot = computed(() => (open.value && time.value > 2.9 ? Math.min(3, Math.floor((time.value - 2.9) / 0.6)) : -1))
</script>

<template>
  <div ref="box" class="menubar" aria-hidden="true">
    <div class="menubar-strip">
      <span class="tray-item" :class="{ 'is-on': open }">
        <img :src="logo" alt="" width="15" height="15" /><em class="mono">{{ title }}</em>
      </span>
      <AppIcon name="search-outline" />
      <span class="mono">9:41</span>
    </div>
    <div class="tray-menu" :class="{ 'is-open': open }">
      <template v-for="(group, g) in ENTRIES" :key="g">
        <hr v-if="g > 0" />
        <div v-for="key in group" :key="key" :class="{ 'is-hot': FLAT.indexOf(key) === hot }">{{ t(key) }}</div>
      </template>
    </div>
    <div class="tray-note"><span>Tauri 2</span><span>Rust</span></div>
  </div>
</template>

<style scoped>
.menubar {
  position: relative;
  height: 100%;
  border-radius: 14px;
  background:
    radial-gradient(90% 90% at 80% 0%, color-mix(in srgb, var(--accent-2) 30%, transparent), transparent 70%),
    linear-gradient(160deg, #2a1d45, #120e1c);
  overflow: hidden;
  direction: ltr;
}
:root[data-theme='light'] .menubar {
  background:
    radial-gradient(90% 90% at 80% 0%, rgba(177, 124, 236, 0.45), transparent 70%),
    linear-gradient(160deg, #d9c9f2, #f4eefb);
}
.menubar-strip {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  height: 32px;
  padding: 0 16px;
  background: rgba(20, 16, 28, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
}
:root[data-theme='light'] .menubar-strip {
  background: rgba(255, 255, 255, 0.6);
  color: #1d1b20;
}
.menubar-strip .ic {
  font-size: 15px;
}
.tray-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 7px;
  border-radius: 5px;
  font: 600 12.5px/1 var(--font);
  font-variant-numeric: tabular-nums;
  transition: background-color 0.2s;
}
.tray-item.is-on {
  background: rgba(255, 255, 255, 0.18);
}
:root[data-theme='light'] .tray-item.is-on {
  background: rgba(0, 0, 0, 0.1);
}
.tray-item img {
  width: 15px;
  height: 15px;
  filter: grayscale(1) brightness(2.2);
}
:root[data-theme='light'] .tray-item img {
  filter: grayscale(1) brightness(0.3);
}
.tray-item em {
  display: inline-block;
  min-width: 52px;
  font-style: normal;
}
.tray-menu {
  position: absolute;
  z-index: 1;
  top: 38px;
  right: 60px;
  width: 210px;
  padding: 5px;
  border-radius: 10px;
  background: rgba(38, 32, 48, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  transform-origin: 80% 0;
  opacity: 0;
  transform: scale(0.94) translateY(-4px);
  transition:
    opacity 0.18s var(--ease-exit),
    transform 0.2s var(--ease-exit);
}
:root[data-theme='light'] .tray-menu {
  background: rgba(246, 242, 250, 0.86);
  border-color: rgba(0, 0, 0, 0.1);
  color: #1d1b20;
  box-shadow: 0 20px 50px rgba(60, 30, 110, 0.2);
}
.tray-menu.is-open {
  opacity: 1;
  transform: none;
  transition:
    opacity 0.22s var(--ease-enter),
    transform 0.32s var(--ease-enter);
}
.tray-menu div {
  padding: 5px 10px;
  border-radius: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.15s;
}
.tray-menu div.is-hot {
  background: #7b3ed1;
  color: #fff;
}
.tray-menu hr {
  margin: 4px 8px;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}
:root[data-theme='light'] .tray-menu hr {
  border-top-color: rgba(0, 0, 0, 0.1);
}
.tray-note {
  position: absolute;
  left: 18px;
  bottom: 16px;
  display: flex;
  gap: 8px;
}
.tray-note span {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.85);
  font: 500 12px/1 var(--mono);
}
:root[data-theme='light'] .tray-note span {
  background: rgba(255, 255, 255, 0.6);
  border-color: rgba(0, 0, 0, 0.08);
  color: #3d3445;
}
</style>
