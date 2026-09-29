/**
 * @fileoverview Theme colours for canvas drawing, re-read only when the page
 * theme changes. Canvas cannot resolve CSS variables or color-mix(), so the
 * values are resolved through the element's computed style.
 */
const cache = new Map<string, { theme: string | undefined; value: string[] }>()

export function themeColors(key: string, read: () => string[]): string[] {
  const theme = document.documentElement.dataset.theme
  const hit = cache.get(key)
  if (hit && hit.theme === theme) return hit.value
  const value = read()
  cache.set(key, { theme, value })
  return value
}

export const cssVar = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

/** Resolve CSS colours (including color-mix) to rgb() strings through a probe inside `host`. */
export function resolveColors(host: Element, colors: string[]): string[] {
  const probe = document.createElement('i')
  probe.hidden = true
  host.append(probe)
  const out = colors.map((c) => {
    probe.style.color = c
    return getComputedStyle(probe).color
  })
  probe.remove()
  return out
}
