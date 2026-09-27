/**
 * A live HTML rebuild of the Rayburst main window: AppSidebar, the task
 * toolbar, TaskItem cards (TaskDragHandle, TaskItemActions, status slot,
 * progress bar, info row), the pager, the Speedometer capsule and the
 * completion toast (useNotificationToast).
 *
 * The window is laid out at real CSS pixel sizes and scaled as a whole to its
 * container, so it stays crisp and keeps the app's proportions. Narrow
 * containers switch to a list-only layout instead of shrinking the text away:
 *   wide   1100 px  sidebar + list + pager + speedometer
 *   mid     760 px  list + speedometer
 *   narrow  440 px  list only, no action pill
 */
import { bytes } from './format.js'
import { esc, h, ic, setAttr, setClass, setStyle, setText } from './dom.js'

const TIERS = [
  { name: 'wide', min: 900, w: 1100 },
  { name: 'mid', min: 560, w: 760 },
  { name: 'narrow', min: 0, w: 440 },
]

const SIDEBAR = [
  ['list-outline', 'ui.all', 'all'],
  ['play-outline', 'ui.progress', 'progress'],
  ['alert-circle-outline', 'ui.failed', 'failed'],
  ['checkmark-done-outline', 'ui.completed', 'completed'],
]
const TOOLS = [
  'swap-vertical-outline',
  'refresh-outline',
  'play-outline',
  'pause-outline',
  'stop-circle-outline',
  'close-outline',
  'trash-outline',
]
const RIGHT = [
  ['remaining', null],
  ['up', 'arrow-up-outline'],
  ['down', 'arrow-down-outline'],
  ['seeders', 'magnet-outline'],
  ['conns', 'git-network-outline'],
]

export class AppWindow {
  /**
   * @param {HTMLElement} host
   * @param {object} o
   * @param {(key: string, vars?: object) => string} o.tr   translator
   * @param {number} [o.height=680]  window height in the wide layout
   * @param {number} [o.rows]        rows to reserve in the list-only layouts
   */
  constructor(host, o) {
    this.host = host
    this.tr = o.tr
    this.height = o.height ?? 680
    this.rows = o.rows ?? 4
    this.cards = new Map()
    this.toastEls = new Map()
    host.classList.add('rbw')
    host.innerHTML = ''
    this.win = h(`
      <div class="rbw-win" role="img">
        <aside class="rbw-side">
          <div class="rbw-side-title" data-k="ui.tasks"></div>
          <ul class="rbw-nav">${SIDEBAR.map(
            ([icon, key, id], i) =>
              `<li class="${i === 0 ? 'is-on' : ''}">${ic(icon)}<span data-k="${key}"></span><b data-count="${id}">0</b></li>`,
          ).join('')}</ul>
          <ul class="rbw-nav rbw-nav-end">
            <li>${ic('information-circle-outline')}<span data-k="ui.about"></span></li>
            <li>${ic('settings-outline')}<span data-k="ui.settings"></span></li>
          </ul>
        </aside>
        <section class="rbw-main">
          <div class="rbw-controls">${ic('remove-outline')}${ic('square-outline')}${ic('close-outline')}</div>
          <header class="rbw-toolbar">
            <span class="rbw-heading" data-k="ui.all"></span>
            <span class="rbw-tools"><i class="rbw-add">${ic('add-outline')}</i>${TOOLS.map((n, i) =>
              ic(n, i < 2 ? 'on' : ''),
            ).join('')}</span>
          </header>
          <div class="rbw-list"></div>
          <footer class="rbw-foot">
            <span class="rbw-pager">${ic('chevron-back-outline')}<b>1</b>${ic('chevron-forward-outline')}</span>
            <span class="rbw-speed">
              ${ic('speedometer-outline', 'rbw-speed-ic')}
              <span class="rbw-speed-rows">
                <span>${ic('arrow-up-outline')}<em data-speed="up">0 KB/s</em></span>
                <span>${ic('arrow-down-outline')}<em data-speed="down">0 KB/s</em></span>
              </span>
              <span class="rbw-speed-lim"><i></i><span>∞</span><span>∞</span></span>
            </span>
          </footer>
          <div class="rbw-toasts"></div>
          <div class="rbw-layer"></div>
        </section>
      </div>`)
    host.append(this.win)
    this.list = this.win.querySelector('.rbw-list')
    this.layer = this.win.querySelector('.rbw-layer')
    this.toastBox = this.win.querySelector('.rbw-toasts')
    this.counts = Object.fromEntries([...this.win.querySelectorAll('[data-count]')].map((el) => [el.dataset.count, el]))
    this.speedEls = Object.fromEntries([...this.win.querySelectorAll('[data-speed]')].map((el) => [el.dataset.speed, el]))
    this.translate()
    this.fit = this.fit.bind(this)
    new ResizeObserver(this.fit).observe(host)
    new ResizeObserver(this.fit).observe(this.win)
    this.fit()
  }

  /** Static labels; call again after a language change. */
  translate() {
    this.win.querySelectorAll('[data-k]').forEach((el) => setText(el, this.tr(el.dataset.k)))
    this.win.setAttribute('aria-label', 'Rayburst')
  }

  fit() {
    const cw = this.host.clientWidth
    if (!cw) return
    const tier = TIERS.find((x) => cw >= x.min)
    if (this.host.dataset.tier !== tier.name) {
      this.host.dataset.tier = tier.name
      setStyle(this.win, 'width', `${tier.w}px`)
      setStyle(this.win, 'height', tier.name === 'wide' ? `${this.height}px` : 'auto')
      setStyle(this.list, 'minHeight', tier.name === 'wide' ? '' : `${this.rows * 136 - 16}px`)
    }
    const k = cw / tier.w
    this.scale = k
    setStyle(this.win, 'transform', `scale(${k})`)
    setStyle(this.host, 'height', `${Math.ceil(this.win.offsetHeight * k)}px`)
  }

  cardEl(id) {
    return this.cards.get(id)?.el ?? null
  }

  /** Render a model from ui/tasks.js. */
  update(m) {
    const seen = new Set()
    let prev = null
    for (const task of m.tasks) {
      seen.add(task.id)
      let card = this.cards.get(task.id)
      if (!card) {
        card = createCard()
        this.cards.set(task.id, card)
      }
      // Keep DOM order equal to model order (new cards may enter at the top).
      const want = prev ? prev.el.nextElementSibling : this.list.firstElementChild
      if (want !== card.el) this.list.insertBefore(card.el, want)
      paintCard(card, task)
      prev = card
    }
    for (const [id, card] of this.cards) {
      if (!seen.has(id)) {
        card.el.remove()
        this.cards.delete(id)
      }
    }
    for (const [id, el] of Object.entries(this.counts)) setText(el, m.counts[id] ?? 0)
    setText(this.speedEls.up, `${bytes(m.speed.up)}/s`)
    setText(this.speedEls.down, `${bytes(m.speed.down)}/s`)
    setClass(this.win, 'is-active', m.speed.active)
  }

  /** Completion toasts: [{ id, text }] currently shown (top-centre, newest last). */
  toasts(list) {
    const ids = new Set(list.map((x) => x.id))
    for (const [id, el] of this.toastEls) {
      if (!ids.has(id) && !el.classList.contains('is-out')) {
        el.classList.add('is-out')
        el.addEventListener('animationend', () => {
          el.remove()
          this.toastEls.delete(id)
        })
      }
    }
    for (const x of list) {
      if (this.toastEls.has(x.id)) continue
      const el = h(`
        <div class="rbw-toast">
          <i class="rbw-toast-ok">${ic('checkmark-outline')}</i>
          <span class="rbw-toast-t">${esc(x.text)}</span>
          <b>${esc(this.tr('ui.openFile'))}</b><b>${esc(this.tr('ui.showInFolder'))}</b>
        </div>`)
      this.toastBox.append(el)
      this.toastEls.set(x.id, el)
    }
  }
}

/** One TaskItem card. */
export function createCard() {
  const el = h(`
    <div class="rbw-slot is-new">
      <article class="rbw-card">
        <span class="rbw-drag" aria-hidden="true"><i></i></span>
        <div class="rbw-body">
          <div class="rbw-head"><span class="rbw-name"></span><span class="rbw-actions"></span></div>
          <div class="rbw-status"><div><span class="rbw-badge"><span class="rbw-badge-ic"></span><span class="rbw-badge-t"></span></span></div></div>
          <div class="rbw-bar"><i></i></div>
          <div class="rbw-info"><span class="rbw-left"></span><span class="rbw-right">${RIGHT.map(
            ([key, icon]) => `<span data-r="${key}">${icon ? ic(icon) : ''}<em></em></span>`,
          ).join('')}</span></div>
        </div>
      </article>
    </div>`)
  el.addEventListener('animationend', () => el.classList.remove('is-new'), { once: true })
  const q = (s) => el.querySelector(s)
  return {
    el,
    card: q('.rbw-card'),
    name: q('.rbw-name'),
    actions: q('.rbw-actions'),
    status: q('.rbw-status'),
    badge: q('.rbw-badge'),
    badgeIc: q('.rbw-badge-ic'),
    badgeT: q('.rbw-badge-t'),
    bar: q('.rbw-bar'),
    left: q('.rbw-left'),
    right: Object.fromEntries(RIGHT.map(([k]) => [k, q(`[data-r="${k}"]`)])),
    rightText: Object.fromEntries(RIGHT.map(([k]) => [k, q(`[data-r="${k}"] em`)])),
    state: {},
  }
}

/** Update a card from a task view (ui/tasks.js). */
export function paintCard(c, task) {
  const st = c.state
  setText(c.name, task.name)
  setAttr(c.name, 'title', task.name)
  const actionsKey = task.actions.join()
  if (st.actions !== actionsKey) {
    st.actions = actionsKey
    c.actions.innerHTML = task.actions.map((n) => `<i data-a="${n}">${ic(n)}</i>`).join('')
  }
  setAttr(c.actions, 'data-hot', task.hot ?? '')
  const badge = task.badge
  setClass(c.status, 'is-on', Boolean(badge))
  if (badge) {
    setAttr(c.badge, 'data-tone', badge.tone)
    if (st.badgeIcon !== badge.icon) {
      st.badgeIcon = badge.icon
      c.badgeIc.innerHTML = ic(badge.icon)
    }
    setText(c.badgeT, badge.text)
  }
  setClass(c.card, 'is-sharing', Boolean(task.sharing))
  setClass(c.card, 'is-focus', Boolean(task.focus))
  setClass(c.bar, 'is-none', task.progress == null)
  setAttr(c.bar, 'data-tone', task.tone)
  setClass(c.bar, 'is-active', Boolean(task.active))
  if (task.progress != null) setStyle(c.bar, '--p', task.progress.toFixed(4))
  setText(c.left, task.left)
  for (const [key] of RIGHT) {
    const v = task.right?.[key]
    const on = v != null && v !== ''
    setClass(c.right[key], 'is-on', on)
    if (on) setText(c.rightText[key], v)
  }
}

/** A single card outside the window, at natural size (feature panels). */
export class CardView {
  constructor(host) {
    host.classList.add('rbw', 'rbw-solo')
    this.card = createCard()
    this.card.el.classList.remove('is-new')
    host.append(this.card.el)
  }

  update(task) {
    if (task) paintCard(this.card, task)
  }
}
