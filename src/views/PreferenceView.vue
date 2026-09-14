<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  isNavigationFailure,
  NavigationFailureType,
  useRoute,
  useRouter,
  type RouteLocationNormalized,
} from 'vue-router'
import { computed, onScopeDispose, shallowRef } from 'vue'
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
const pendingNavigation = shallowRef<RouteLocationNormalized | null>(null)
const activePath = computed(() => pendingNavigation.value?.path ?? route.path)

const removeBeforeGuard = router.beforeEach(async (to, from) => {
  if (to.path === from.path || !to.path.startsWith('/preference/')) return
  pendingNavigation.value = to
  // Paint navigation feedback before loading and mounting the next form.
  await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
})
const removeAfterGuard = router.afterEach((to, _from, failure) => {
  if (pendingNavigation.value === to || isNavigationFailure(failure, NavigationFailureType.duplicated)) {
    pendingNavigation.value = null
  }
})
const removeErrorHandler = router.onError((_error, to) => {
  if (pendingNavigation.value === to) pendingNavigation.value = null
})
onScopeDispose(() => {
  removeBeforeGuard()
  removeAfterGuard()
  removeErrorHandler()
})
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
        :class="{
          'is-active': activePath.endsWith(category) || (category === 'general' && activePath === '/preference'),
        }"
        :aria-current="route.path.endsWith(category) ? 'page' : undefined"
        >{{ t(`preferences.${category}`) }}</RouterLink
      >
    </nav>
    <div class="panel-body" :aria-busy="!!pendingNavigation" :inert="!!pendingNavigation">
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
.settings-tabs a.is-active {
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
