<script setup lang="ts">
import { NModal, NCard } from 'naive-ui'

withDefaults(
  defineProps<{
    show: boolean
    title: string
    size?: 'small' | 'regular' | 'wide'
    busy?: boolean
    maskClosable?: boolean
    autoFocus?: boolean
  }>(),
  { size: 'regular', busy: false, maskClosable: false, autoFocus: true },
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
      :class="`app-dialog--${size}`"
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
  border-radius: 12px;
  box-shadow: 0 12px 40px var(--m3-shadow);
  width: min(560px, calc(100vw - 48px));
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
}
.app-dialog--small.n-card {
  width: min(400px, calc(100vw - 48px));
}
.app-dialog--wide.n-card {
  width: min(760px, calc(100vw - 48px));
}
.app-dialog.n-card > .n-card-header {
  padding: 24px 24px 16px;
  flex: none;
}
.app-dialog.n-card > .app-dialog-content {
  padding: 0 24px 24px;
  min-height: 0;
  overflow: auto;
}
.app-dialog.n-card > .n-card__footer {
  padding: 16px 24px 20px;
  flex: none;
  border-top: 1px solid var(--divider);
}
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
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
