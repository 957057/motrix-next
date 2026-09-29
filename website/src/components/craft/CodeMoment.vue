<script setup lang="ts">
/**
 * @fileoverview Open to the last line: rayburst/src/shared/constants.ts, lines
 * 64–77, verbatim, with the default connection count highlighted.
 */
import { useResizeObserver } from '@vueuse/core'
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const FIRST = 64
const HOT = 74
const CODE = [
  'export const ENGINE_RPC_PORT = 29100',
  'export const EXTENSION_API_PORT = 29110',
  'export const BT_LISTEN_PORT = 29120',
  'export const ED2K_LISTEN_PORT = 29140',
  'export const ED2K_UDP_LISTEN_PORT = 29150',
  "export const ED2K_SERVER_MET_URL = 'https://upd.emule-security.org/server.met'",
  "export const ED2K_NODES_DAT_URL = 'https://upd.emule-security.org/nodes.dat'",
  "export const BT_PEER_BLOCKLIST_URL = 'https://bcr.pbh-btn.com/combine/all.txt'",
  'export const PORT_RECOVERY_RANGE_START = 29000',
  'export const PORT_RECOVERY_RANGE_END = 29999',
  'export const ENGINE_DEFAULT_STREAM_CONNECTIONS = 64',
  'export const ENGINE_DEFAULT_BT_MAX_PEERS = 128',
  "export const ENGINE_DEFAULT_BT_USER_AGENT = 'qBittorrent/5.2.3'",
  "export const ENGINE_DEFAULT_BT_PEER_ID_PREFIX = '-qB5230-'",
]

/** Split `export const NAME = value` into highlighted tokens. */
const LINES = CODE.map((line, i) => {
  const [, name, value] = line.match(/^export const (\w+) = (.*)$/) ?? ['', line, '']
  return { n: FIRST + i, name, value, kind: value.startsWith("'") ? 'st' : 'nu' }
})

// Keep the highlighted line in view on short tiles.
const pre = ref<HTMLElement | null>(null)
useResizeObserver(pre, () => {
  const el = pre.value
  const hot = el?.querySelector<HTMLElement>('.is-hot')
  if (el && hot) el.scrollTop = Math.max(0, hot.offsetTop - el.clientHeight * 0.55)
})
</script>

<template>
  <div class="code" aria-hidden="true">
    <div class="code-bar"><AppIcon name="code-slash-outline" />src/shared/constants.ts</div>
    <pre
      ref="pre"
    ><span v-for="l in LINES" :key="l.n" :data-n="l.n" :class="{ 'is-hot': l.n === HOT }"><span class="kw">export const </span>{{ l.name }} = <span :class="l.kind">{{ l.value }}</span></span></pre>
  </div>
</template>

<style scoped>
.code {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg) 70%, var(--card));
  border: 1px solid var(--line);
  overflow: hidden;
  direction: ltr;
  text-align: left;
}
.code-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  color: var(--text-3);
  font: 500 12px/1 var(--mono);
}
.code-bar .ic {
  font-size: 13px;
  color: #3178c6;
}
.code pre {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 10px 0;
  font: 400 12px/1.8 var(--mono);
  overflow: hidden;
}
.code pre > span {
  display: block;
  padding: 0 12px;
  white-space: pre;
}
.code pre > span::before {
  content: attr(data-n);
  display: inline-block;
  width: 26px;
  margin-right: 12px;
  color: var(--text-3);
  opacity: 0.6;
  text-align: right;
}
.code pre > span.is-hot {
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent-2) 22%, transparent), transparent);
  box-shadow: inset 2px 0 0 var(--accent);
}
.code .kw {
  color: #c792ea;
}
.code .id {
  color: var(--text);
}
.code .nu {
  color: #f78c6c;
}
.code .st {
  color: #a5d98b;
}
:root[data-theme='light'] .code .kw {
  color: #7b3ed1;
}
:root[data-theme='light'] .code .nu {
  color: #b5540e;
}
:root[data-theme='light'] .code .st {
  color: #2d7a1f;
}
</style>
