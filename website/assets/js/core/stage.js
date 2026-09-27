/**
 * Time-based playback for the page's animated scenes.
 *
 * A stage starts its clock the first time it comes into view, advances only
 * while it is on screen and the tab is visible, and draws its final frame when
 * the scene ends. Scroll speed never affects what is drawn: the scene is a
 * pure function of its own clock. With reduced motion, the final frame is
 * drawn once and nothing runs.
 */
import { reducedMotion } from './motion.js'

const MAX_STEP = 1 / 20

export class Stage {
  /**
   * @param {Element} el       element whose visibility drives the clock
   * @param {object} o
   * @param {(t: number, dt: number) => void} o.render  draw the scene at time t (seconds)
   * @param {number} [o.duration=Infinity]  scene length; after it the clock stops
   * @param {number} [o.loop]   restart the clock after this many seconds
   * @param {number} [o.still]  time drawn with reduced motion (defaults to duration)
   * @param {boolean} [o.autostart=true]  start on first view (false: call play())
   */
  constructor(el, o) {
    this.el = el
    this.render = o.render
    this.duration = o.duration ?? Infinity
    this.loop = o.loop ?? 0
    this.still = o.still ?? (Number.isFinite(this.duration) ? this.duration : 0)
    this.autostart = o.autostart ?? true
    this.t = 0
    this.started = false
    this.visible = false
    this.running = false
    this.last = 0
    this.frame = this.frame.bind(this)

    if (reducedMotion()) {
      queueMicrotask(() => this.render(this.still, 0))
      return
    }
    // Start once the stage is well inside the viewport; pause as soon as it is fully out.
    const start = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && this.autostart && !this.started) this.play()
      },
      { rootMargin: '-18% 0px -18% 0px' },
    )
    const presence = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting
      this.wake()
    })
    start.observe(el)
    presence.observe(el)
    document.addEventListener('visibilitychange', () => this.wake())
    this.render(0, 0)
  }

  play() {
    if (reducedMotion()) return this.render(this.still, 0)
    this.started = true
    this.done = false
    this.wake()
  }

  replay() {
    this.t = 0
    this.play()
  }

  /** Jump to a time and keep playing from there. */
  seek(t) {
    this.t = t
    this.done = false
    this.render(this.t, 0)
    this.wake()
  }

  wake() {
    const should = this.started && !this.done && this.visible && !document.hidden
    if (should && !this.running) {
      this.running = true
      this.last = performance.now()
      requestAnimationFrame(this.frame)
    } else if (!should) {
      this.running = false
    }
  }

  frame(now) {
    if (!this.running) return
    // Clamp the step so a stalled frame never makes the scene jump.
    const dt = Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000))
    this.last = now
    this.t += dt
    if (this.loop && this.t >= this.loop) this.t -= this.loop
    if (this.t >= this.duration) {
      this.t = this.duration
      this.done = true
      this.running = false
      this.render(this.t, dt)
      this.el.dispatchEvent(new CustomEvent('stage:end'))
      return
    }
    this.render(this.t, dt)
    requestAnimationFrame(this.frame)
  }
}

/**
 * One-shot reveals for [data-reveal] elements: a fixed-length CSS transition
 * that starts when the element enters the viewport. Elements already above the
 * viewport (after a reload or an anchor jump) are shown at once.
 */
export function initReveals(root = document) {
  const items = root.querySelectorAll('[data-reveal]')
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        } else if (e.boundingClientRect.bottom < 0) {
          e.target.classList.add('is-in', 'is-instant')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  items.forEach((el) => io.observe(el))
}
