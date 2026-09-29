/**
 * @fileoverview GSAP setup: plugins, Rayburst's Material 3 curves and small
 * deterministic noise helpers for the simulations.
 */
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { Flip } from 'gsap/Flip'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(CustomEase, DrawSVGPlugin, Flip, MotionPathPlugin, SplitText)

/** Named eases, usable as GSAP `ease` strings and as functions of 0..1. */
export const EASE = {
  enter: CustomEase.create('m3-enter', '0.2, 0, 0, 1'),
  exit: CustomEase.create('m3-exit', '0.3, 0, 0.8, 0.15'),
  text: CustomEase.create('text', '0.33, 1, 0.68, 1'),
  inOut: gsap.parseEase('power2.inOut'),
  smooth: gsap.parseEase('sine.inOut'),
} as const

export const clamp = gsap.utils.clamp(0, 1) as (value: number) => number
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Progress of `t` through the window [start, start + dur], clamped to 0..1. */
export const prog = (t: number, start: number, dur: number) =>
  dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur)

/** Hermite smoothstep, for speed ramps in the simulations. */
export const smoothstep = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

/** Deterministic hash noise in 0..1. */
export function hash(a: number, b = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Smooth 1-D value noise in -1..1, for gentle speed jitter. */
export function noise(x: number, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export { Flip, gsap, MotionPathPlugin, SplitText }
