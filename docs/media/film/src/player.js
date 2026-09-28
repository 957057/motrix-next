/**
 * Preview player: real-time playback synced to ./out/soundtrack.wav when it
 * exists, scrubbing, section jumps, language switch and motion-blur toggle.
 *
 * Keys: Space play/pause · ←/→ one frame · Shift+←/→ one second ·
 *       1–9 jump to section · M motion blur · L loop current section
 */
export function startPlayer({ FILM, T, L, LOCALES, params }) {
  const $ = (id) => document.getElementById(id)
  const scrub = $('scrub')
  const time = $('time')
  const playBtn = $('play')
  const blurBtn = $('blur')
  const loopBtn = $('loop')
  const langSel = $('lang')
  const marks = $('marks')
  const audio = new Audio('./out/soundtrack.wav')
  audio.preload = 'auto'
  let hasAudio = false
  audio.addEventListener('canplaythrough', () => (hasAudio = true), { once: true })
  audio.addEventListener('error', () => ($('note').textContent = 'No soundtrack yet: run npm run audio'), {
    once: true,
  })

  let t = Math.min(Math.max(Number(params.get('t') ?? 0), 0), FILM.duration)
  let playing = false
  let blur = false
  let loop = null
  let last = performance.now()
  let dirty = true

  scrub.max = String(FILM.duration)
  scrub.step = String(1 / FILM.fps)
  for (const code of Object.keys(LOCALES)) {
    const o = document.createElement('option')
    o.value = code
    o.textContent = LOCALES[code].meta.name
    if (code === L.code) o.selected = true
    langSel.append(o)
  }
  langSel.onchange = () => {
    const q = new URLSearchParams(location.search)
    q.set('lang', langSel.value)
    q.set('t', t.toFixed(3))
    location.search = q.toString()
  }
  FILM.sections.forEach((s, i) => {
    const b = document.createElement('button')
    b.textContent = `${i + 1} ${s.id}`
    b.style.left = `${(s.start / FILM.duration) * 100}%`
    b.onclick = () => seek(s.start)
    marks.append(b)
  })
  if (FILM.missingFonts.length) $('note').textContent = `Missing fonts: ${FILM.missingFonts.join(', ')} (npm run fonts)`

  function seek(v) {
    t = Math.min(Math.max(v, 0), FILM.duration - 1 / FILM.fps)
    if (hasAudio) audio.currentTime = t
    dirty = true
  }
  function setPlaying(v) {
    playing = v
    playBtn.textContent = playing ? 'Pause' : 'Play'
    if (hasAudio) {
      if (playing) {
        audio.currentTime = t
        audio.play().catch(() => {})
      } else audio.pause()
    }
    last = performance.now()
  }
  playBtn.onclick = () => setPlaying(!playing)
  blurBtn.onclick = () => {
    blur = !blur
    blurBtn.classList.toggle('on', blur)
    dirty = true
  }
  loopBtn.onclick = () => {
    const s = FILM.sections.find((x) => t >= x.start && t < x.end)
    loop = loop ? null : s
    loopBtn.classList.toggle('on', Boolean(loop))
  }
  scrub.oninput = () => seek(Number(scrub.value))

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement) return
    const frame = 1 / FILM.fps
    if (e.code === 'Space') {
      e.preventDefault()
      setPlaying(!playing)
    } else if (e.code === 'ArrowRight') seek(t + (e.shiftKey ? 1 : frame))
    else if (e.code === 'ArrowLeft') seek(t - (e.shiftKey ? 1 : frame))
    else if (e.code === 'KeyM') blurBtn.click()
    else if (e.code === 'KeyL') loopBtn.click()
    else if (/^Digit[1-9]$/.test(e.code)) {
      const s = FILM.sections[Number(e.code.slice(5)) - 1]
      if (s) seek(s.start)
    }
  })

  function tick(now) {
    if (playing) {
      if (hasAudio && !audio.paused) t = audio.currentTime
      else t += (now - last) / 1000
      if (loop && t >= loop.end) seek(loop.start)
      if (t >= FILM.duration) {
        t = FILM.duration - 1 / FILM.fps
        setPlaying(false)
      }
      dirty = true
    }
    last = now
    if (dirty) {
      const f = Math.floor(t * FILM.fps)
      FILM.renderFrame(f, blur && !playing ? 8 : 1, 0.5)
      scrub.value = String(t)
      const sec = FILM.sections.find((x) => t >= x.start && t < x.end)
      time.textContent = `${t.toFixed(2)}s · beat ${(t / T.spb).toFixed(2)} · ${sec?.id ?? ''}`
      dirty = false
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
