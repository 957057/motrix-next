<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { NSelect, NIcon } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import { settingsCatalog } from '@shared/settingsCatalog'
import { usePlatform } from '@/composables/usePlatform'
import { useAppStore } from '@/stores/app'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { platform } = usePlatform()
const app = useAppStore()
const searchOptions = computed(() =>
  settingsCatalog
    .filter(
      (item) => (!item.platforms || item.platforms.includes(platform.value)) && (!item.updates || app.updatesAvailable),
    )
    .map((item) => ({ label: `${t(item.key)} · ${t('preferences.' + item.category)}`, value: item.key })),
)
function goToSetting(key: string | null) {
  const item = settingsCatalog.find((item) => item.key === key)
  if (item) void router.push({ path: `/preference/${item.category}`, hash: `#setting-${item.key}` })
}
const categories = ['general', 'downloads', 'network', 'bt', 'ed2k', 'connections', 'advanced']
</script>
<template>
  <section class="preference-view">
    <header class="settings-header">
      <h1>{{ t('app.preferences') }}</h1>
      <NSelect
        class="settings-search"
        :value="null"
        filterable
        clearable
        :options="searchOptions"
        :placeholder="t('preferences.search-settings')"
        :aria-label="t('preferences.search-settings')"
        @update:value="goToSetting"
        ><template #arrow
          ><NIcon><SearchOutline /></NIcon></template
      ></NSelect>
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
.settings-search {
  width: min(360px, 48%);
}
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
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
