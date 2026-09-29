/**
 * @fileoverview Motion directives.
 *
 *   v-reveal[.scale|.fade]="index"  one-shot rise when the element enters the
 *                                   viewport; elements already above it (after
 *                                   a reload or an anchor jump) appear at once
 *   v-spotlight                     a soft light that follows the pointer
 *                                   across a card (CSS reads --mx / --my)
 */
import type { Directive } from 'vue'
import { EASE, gsap, reducedMotion } from './gsap'

const observers = new WeakMap<HTMLElement, IntersectionObserver>()

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, { value = 0, modifiers }) {
    if (reducedMotion()) return
    const from = modifiers.fade ? { y: 0 } : modifiers.scale ? { y: 28, scale: 0.97 } : { y: 22 }
    gsap.set(el, { autoAlpha: 0, ...from })
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting) {
          gsap.to(el, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            delay: value * 0.07,
            ease: EASE.text,
            clearProps: 'transform,opacity,visibility',
          })
        } else if (entry.boundingClientRect.bottom < 0) {
          gsap.set(el, { clearProps: 'transform,opacity,visibility' })
        } else return
        io.disconnect()
        observers.delete(el)
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    observers.set(el, io)
  },
  unmounted(el) {
    observers.get(el)?.disconnect()
    observers.delete(el)
    gsap.killTweensOf(el)
  },
}

const spotlights = new WeakMap<HTMLElement, (e: PointerEvent) => void>()

export const vSpotlight: Directive<HTMLElement> = {
  mounted(el) {
    const setX = gsap.quickSetter(el, '--mx', 'px')
    const setY = gsap.quickSetter(el, '--my', 'px')
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      setX(e.clientX - r.left)
      setY(e.clientY - r.top)
    }
    el.classList.add('spot')
    el.addEventListener('pointermove', move, { passive: true })
    spotlights.set(el, move)
  },
  unmounted(el) {
    const move = spotlights.get(el)
    if (move) el.removeEventListener('pointermove', move)
    spotlights.delete(el)
  },
}
