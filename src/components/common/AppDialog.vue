<script setup lang="ts">
import { NModal, NCard } from 'naive-ui'

withDefaults(
  defineProps<{
    show: boolean
    title: string
    size?: 'small' | 'regular' | 'wide'
    height?: string
    busy?: boolean
    maskClosable?: boolean
    autoFocus?: boolean
  }>(),
  { size: 'regular', height: undefined, busy: false, maskClosable: false, autoFocus: true },
)
const emit = defineEmits<{ close: []; afterLeave: [] }>()
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="maskClosable && !busy"
    :close-on-esc="!busy"
    :auto-focus="autoFocus"
    @update:show="(value) => !value && emit('close')"
    @after-leave="emit('afterLeave')"
  >
    <NCard
      class="app-dialog"
      content-class="app-dialog-content"
      :class="[`app-dialog--${size}`, { 'app-dialog--fixed': height }]"
      :style="{ height }"
      :title="title"
      :bordered="false"
      :closable="!busy"
      role="dialog"
      :aria-label="title"
      aria-modal="true"
      @close="emit('close')"
    >
      <slot />
      <template v-if="$slots.footer" #footer
        ><div class="dialog-actions"><slot name="footer" /></div
      ></template>
    </NCard>
  </NModal>
</template>

<style>
.app-dialog.n-card {
  border-radius: var(--rb-radius-dialog);
  box-shadow: var(--rb-shadow-overlay);
  width: min(560px, calc(100vw - 48px));
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--rb-overlay);
}

.app-dialog--small.n-card {
  width: min(420px, calc(100vw - 48px));
}

.app-dialog--wide.n-card {
  width: min(780px, calc(100vw - 48px));
}

.app-dialog.n-card > .n-card-header {
  padding: 22px 24px 14px;
  flex: none;
}

.app-dialog.n-card > .n-card-header .n-card-header__main {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.app-dialog.n-card > .app-dialog-content {
  padding: 4px 24px 24px;
  min-height: 0;
  overflow: auto;
}

.app-dialog--fixed.n-card > .app-dialog-content {
  scrollbar-gutter: stable;
  overflow-anchor: none;
}

.app-dialog.n-card > .n-card__footer {
  padding: 14px 24px 18px;
  flex: none;
  border-top: 1px solid var(--rb-hairline);
  background: var(--rb-canvas);
  border-end-start-radius: var(--rb-radius-dialog);
  border-end-end-radius: var(--rb-radius-dialog);
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.dialog-actions > .n-space {
  width: 100%;
}

.app-dialog .n-form-item-label {
  font-weight: 500;
}

@media (max-height: 400px) {
  .app-dialog.n-card > .n-card-header {
    padding-block: 12px;
  }

  .app-dialog.n-card > .n-card__footer {
    padding-block: 12px;
  }
}
</style>
