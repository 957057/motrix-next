<script setup lang="ts">
/** @fileoverview Footer: license, project links and what Rayburst is built with. */
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { LINKS } from '@/links'
import logo from '@/assets/img/logo.svg'
import tauri from '@/assets/img/tauri.svg'
import vite from '@/assets/img/vite.svg'

const { t } = useI18n()
</script>

<template>
  <footer class="foot">
    <div class="foot-inner">
      <div class="foot-brand">
        <img :src="logo" alt="" width="22" height="22" />
        <span>{{ t('footer.license') }}</span>
      </div>
      <nav class="foot-links" aria-label="Rayburst">
        <a :href="LINKS.github" target="_blank" rel="noopener">GitHub</a>
        <a :href="LINKS.contributing" target="_blank" rel="noopener">{{ t('footer.contributing') }}</a>
        <a :href="LINKS.conduct" target="_blank" rel="noopener">{{ t('footer.coc') }}</a>
        <a class="foot-heart beat-on-hover" :href="LINKS.sponsor" target="_blank" rel="noopener">
          <AppIcon name="heart" class="heart" /><span>{{ t('hero.sponsor') }}</span>
        </a>
        <a :href="LINKS.privacy" target="_blank" rel="noopener">{{ t('footer.privacy') }}</a>
        <a :href="LINKS.signing" target="_blank" rel="noopener">{{ t('footer.signing') }}</a>
      </nav>
      <div class="foot-built">
        <span>{{ t('footer.built') }}</span>
        <a :href="LINKS.tauri" target="_blank" rel="noopener"
          ><img :src="tauri" alt="" width="16" height="16" />Tauri</a
        >
        ·
        <a :href="LINKS.vite" target="_blank" rel="noopener"><img :src="vite" alt="" width="16" height="16" />Vite</a>
        ·
        <a :href="LINKS.engine" target="_blank" rel="noopener">Aria2 Next</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  padding: 40px var(--gutter) 48px;
  border-top: 1px solid var(--line);
  color: var(--text-3);
  font-size: 14px;
}
.foot-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: var(--maxw);
  margin: 0 auto;
}
.foot-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-2);
}
.foot-brand img {
  width: 22px;
  height: 22px;
}
.foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}
.foot-links a {
  transition: color 0.2s;
}
.foot-links a:hover {
  color: var(--text);
}
.foot-links .foot-heart {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--rose);
}
.foot-heart .ic {
  font-size: 14px;
}
.foot-built {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.foot-built a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
}
.foot-built a:hover {
  color: var(--text);
}
.foot-built img {
  width: 16px;
  height: 16px;
}
</style>
