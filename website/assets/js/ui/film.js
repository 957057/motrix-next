/** Load the official player only after a visitor opens the film. */
import { locale, onChange, t } from '../i18n.js'

export function initFilm() {
  const dialog = document.getElementById('film')
  const stage = document.getElementById('film-stage')
  const link = document.getElementById('film-open')
  const videoId = new URL(link.href).searchParams.get('v')
  document.getElementById('film-youtube').href = link.href

  onChange(() => {
    const player = stage.querySelector('iframe')
    if (player) player.title = `${t('film.watch')} · ${t('film.language')}`
  })

  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (dialog.open) return
    const player = document.createElement('iframe')
    const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
    url.search = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', hl: locale() })
    player.src = url.href
    player.title = `${t('film.watch')} · ${t('film.language')}`
    player.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'
    player.allowFullscreen = true
    player.referrerPolicy = 'strict-origin-when-cross-origin'
    stage.replaceChildren(player)
    dialog.showModal()
  })
  dialog.addEventListener('close', () => stage.replaceChildren())
}
