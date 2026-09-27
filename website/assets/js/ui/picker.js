/**
 * Pop-up menus (language, theme, Aria2 Next builds): one open at a time,
 * closed by an outside click, Escape or picking an entry.
 */
export function picker(root) {
  const toggle = root.querySelector('.picker-toggle, [data-toggle]')
  const menu = root.querySelector('.picker-menu')
  const close = () => {
    root.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
  }
  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = !root.classList.contains('is-open')
    document.querySelectorAll('.picker.is-open').forEach((p) => p !== root && p.classList.remove('is-open'))
    root.classList.toggle('is-open', open)
    toggle.setAttribute('aria-expanded', String(open))
  })
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a[href]')) close()
  })
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
  return close
}
