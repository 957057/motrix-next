/** @fileoverview Layout helpers for overlays drawn across a scene. */
export type Point = readonly [number, number]

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Position of `el`'s box relative to `root`, in CSS pixels. */
export function rectIn(el: Element, root: Element): Box {
  const a = el.getBoundingClientRect()
  const b = root.getBoundingClientRect()
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }
}

/** Centre of `el` relative to `root`. */
export function centerIn(el: Element, root: Element): Point {
  const r = rectIn(el, root)
  return [r.x + r.w / 2, r.y + r.h / 2]
}

export const isRtlPage = () => document.documentElement.dir === 'rtl'
