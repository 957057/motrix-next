<script setup lang="ts">
/** @fileoverview Empty-state block: brand mark on a soft glow, a title, an optional hint and action. */
import logo from '@/assets/rayburst.svg'

defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <div class="empty-state" role="status">
    <span class="empty-mark" aria-hidden="true">
      <img :src="logo" width="44" height="44" alt="" />
    </span>
    <h2 class="empty-title">{{ title }}</h2>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
    <div v-if="$slots.default" class="empty-action"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  padding: 32px 24px;
}

.empty-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  margin-bottom: 10px;
  border-radius: 28px;
  background: var(--rb-raised);
  box-shadow: var(--rb-shadow-raised);
}

.empty-mark::before {
  content: '';
  position: absolute;
  inset: -28px;
  z-index: -1;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--rb-glow), transparent 72%);
  opacity: 0.7;
}

.empty-mark img {
  filter: saturate(0.9);
}

.empty-title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--rb-text);
}

.empty-hint {
  max-inline-size: 360px;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--rb-text-muted);
}

.empty-action {
  margin-top: 10px;
}
</style>
