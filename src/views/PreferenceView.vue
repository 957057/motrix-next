<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
const { t } = useI18n()
const route = useRoute()
const categories = ['general', 'downloads', 'network', 'bt', 'ed2k', 'advanced']
</script>
<template>
  <section class="preference-view">
    <header class="settings-header">
      <h1>{{ t('app.preferences') }}</h1>
    </header>
    <nav class="settings-tabs" :aria-label="t('app.preferences')">
      <RouterLink
        v-for="category in categories"
        :key="category"
        :to="`/preference/${category}`"
        :aria-current="route.path.endsWith(category) ? 'page' : undefined"
        >{{ t(`preferences.${category}`) }}</RouterLink
      >
    </nav>
    <div class="panel-body">
      <router-view v-slot="{ Component }"
        ><Transition
          name="view"
          @before-leave="(el) => el.setAttribute('inert', '')"
          @before-enter="(el) => el.removeAttribute('inert')"
          @leave-cancelled="(el) => el.removeAttribute('inert')"
          ><component :is="Component" /></Transition
      ></router-view>
    </div>
  </section>
</template>
<style scoped>
.preference-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.settings-header {
  padding: 16px 24px 20px;
}
h1 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.settings-tabs {
  display: flex;
  gap: 24px;
  margin-inline: 24px;
  border-bottom: 1px solid var(--divider);
  overflow-x: auto;
  flex-shrink: 0;
}
.settings-tabs a {
  padding-block: 8px 12px;
  white-space: nowrap;
  text-decoration: none;
  color: var(--m3-on-surface-variant);
  border-bottom: 2px solid transparent;
}
.settings-tabs a[aria-current] {
  color: var(--m3-primary);
  border-bottom-color: var(--m3-primary);
}
.panel-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
@media (max-width: 719px) {
  .settings-header {
    padding: 8px 16px 16px;
  }
  .settings-tabs {
    margin-inline: 16px;
    gap: 16px;
  }
}
</style>
