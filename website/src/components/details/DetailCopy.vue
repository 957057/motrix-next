<script setup lang="ts">
/** @fileoverview The text column of a details panel: number, title, description and live metrics. */
defineProps<{ n: number; title: string; sub: string }>()
</script>

<template>
  <div class="dp-copy">
    <span class="dp-n mono">0{{ n }}</span>
    <h3 class="dp-title">{{ title }}</h3>
    <p class="dp-sub">{{ sub }}</p>
    <div class="dp-metrics"><slot /></div>
  </div>
</template>

<style scoped>
.dp-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.dp-n {
  color: var(--c);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.dp-title {
  margin: 12px 0 0;
  font-size: clamp(24px, 2.6vw, 32px);
  line-height: 1.15;
  font-weight: 720;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.dp-sub {
  margin: 12px 0 0;
  color: var(--text-2);
  font-size: 16px;
  line-height: 1.55;
  text-wrap: pretty;
}
.dp-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 28px;
}
.dp-metrics :deep(.metric) {
  padding: 14px 16px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  border: 1px solid var(--line);
}
.dp-metrics :deep(.metric b) {
  display: block;
  color: var(--text);
  font: 650 clamp(22px, 2.2vw, 28px) / 1.1 var(--mono);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dp-metrics :deep(.metric > span) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--text-3);
  font-size: 13px;
}
.dp-metrics :deep(.metric > span)::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c);
}
.dp-metrics :deep(.metric > span.is-live)::before {
  background: #ff5f7a;
  box-shadow: 0 0 10px #ff5f7a;
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    opacity: 0.35;
  }
}
</style>
