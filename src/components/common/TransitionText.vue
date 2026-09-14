<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span class="transition-text">
    <Transition
      name="text"
      @before-leave="(element) => element.setAttribute('aria-hidden', 'true')"
      @before-enter="(element) => element.removeAttribute('aria-hidden')"
      @leave-cancelled="(element) => element.removeAttribute('aria-hidden')"
    >
      <span :key="text">{{ text }}</span>
    </Transition>
  </span>
</template>

<style scoped>
.transition-text {
  display: inline-grid;
  vertical-align: bottom;
}
.transition-text > span {
  grid-area: 1 / 1;
}
.text-enter-active,
.text-leave-active {
  transition: opacity 160ms cubic-bezier(0.2, 0, 0, 1);
}
.text-enter-from,
.text-leave-to {
  opacity: 0;
}
</style>
