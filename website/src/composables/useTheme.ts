/**
 * @fileoverview Page theme: system, light or dark, stored in local storage and
 * written to <html data-theme>. Picking a theme reveals it in a circle from
 * the control (View Transitions); the browser chrome color follows.
 */
import { useColorMode } from '@vueuse/core'
import { computed, nextTick, watch } from 'vue'
import { reducedMotion } from '@/motion/gsap'

export type ThemeChoice = 'auto' | 'light' | 'dark'

const THEME_COLOR = { dark: '#0b0910', light: '#fbf8fd' }

function createMode() {
  const mode = useColorMode({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: 'rayburst-website-theme',
    disableTransition: false,
  })
  // The page is only ever light or dark; "auto" resolves to the system preference.
  const state = computed<'light' | 'dark'>(() => (mode.state.value === 'light' ? 'light' : 'dark'))
  watch(
    state,
    (value) => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[value]),
    {
      immediate: true,
    },
  )
  return { store: mode.store, state }
}

let mode: ReturnType<typeof createMode> | null = null

export function useTheme() {
  const m = (mode ??= createMode())

  /** Apply a choice, revealing it in a circle centred on `origin` when motion is allowed. */
  async function choose(choice: ThemeChoice, origin?: DOMRect) {
    if (!document.startViewTransition || reducedMotion() || !origin) {
      m.store.value = choice
      return
    }
    const x = origin.left + origin.width / 2
    const y = origin.top + origin.height / 2
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const vt = document.startViewTransition(async () => {
      m.store.value = choice
      await nextTick()
    })
    await vt.ready
    document.documentElement.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.2, 0, 0, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }

  return { store: m.store, state: m.state, choose }
}
