/** Small DOM helpers shared by the scenes. */

/** Inline icon from the page sprite (Ionicons 5, the set Rayburst uses). */
export function ic(name, cls = '') {
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`
}

/** Create an element from an HTML string. */
export function h(html) {
  const tpl = document.createElement('template')
  tpl.innerHTML = html.trim()
  return tpl.content.firstElementChild
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/**
 * Write-through caches so per-frame updates only touch the DOM when a value
 * actually changes.
 */
const TEXT = new WeakMap()
export function setText(el, value) {
  if (!el) return
  const v = String(value ?? '')
  if (TEXT.get(el) === v) return
  TEXT.set(el, v)
  el.textContent = v
}

const STYLE = new WeakMap()
export function setStyle(el, prop, value) {
  if (!el) return
  let map = STYLE.get(el)
  if (!map) STYLE.set(el, (map = {}))
  if (map[prop] === value) return
  map[prop] = value
  if (prop.startsWith('--')) el.style.setProperty(prop, value)
  else el.style[prop] = value
}

export function setClass(el, cls, on) {
  if (el && el.classList.contains(cls) !== Boolean(on)) el.classList.toggle(cls, Boolean(on))
}

export function setAttr(el, name, value) {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value)
}

/** Replace {name} placeholders. */
export function fmt(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
}

/** Position of `el`'s box relative to `root`, in CSS pixels. */
export function rectIn(el, root) {
  const a = el.getBoundingClientRect()
  const b = root.getBoundingClientRect()
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }
}
