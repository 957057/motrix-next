/**
 * Shared timeline. timeline.json is the single source of truth for tempo,
 * sections, drum patterns and sync events; audio/soundtrack.py reads the same file.
 */

export class Timeline {
  constructor(data) {
    this.data = data
    this.bpm = data.bpm
    this.spb = 60 / data.bpm
    this.bpb = data.beatsPerBar
    this.steps = data.stepsPerBar
    this.fps = data.fps
    this.width = data.width
    this.height = data.height
    this.duration = data.bars * this.bpb * this.spb
    this.sections = data.sections.map((s, index) => ({
      ...s,
      index,
      start: s.beat * this.spb,
      end: (s.beat + s.beats) * this.spb,
      dur: s.beats * this.spb,
    }))
    this.hits = this.#collectHits()
  }

  #collectHits() {
    const hits = {}
    for (const sec of this.sections) {
      sec.drums.forEach((name, bar) => {
        const pattern = this.data.patterns[name]
        if (!pattern) throw new Error(`Unknown drum pattern: ${name}`)
        for (const [voice, steps] of Object.entries(pattern)) {
          const list = (hits[voice] ??= [])
          for (const step of steps) list.push((sec.beat + bar * this.bpb + (step * this.bpb) / this.steps) * this.spb)
        }
      })
    }
    for (const list of Object.values(hits)) list.sort((a, b) => a - b)
    return hits
  }

  /** Seconds at a beat index. */
  beat(b) {
    return b * this.spb
  }

  /** Seconds of a named event. */
  ev(id) {
    const e = this.data.events[id]
    if (!e) throw new Error(`Unknown timeline event: ${id}`)
    return e.beat * this.spb
  }

  evLen(id) {
    const e = this.data.events[id]
    return (e?.len ?? 1) * this.spb
  }

  section(id) {
    const s = this.sections.find((x) => x.id === id)
    if (!s) throw new Error(`Unknown section: ${id}`)
    return s
  }

  sectionIndexAt(t) {
    const secs = this.sections
    for (let i = secs.length - 1; i >= 0; i--) if (t >= secs[i].start) return i
    return 0
  }

  /** Time since the most recent hit of a drum voice (Infinity if none). */
  since(t, voice = 'kick') {
    const list = this.hits[voice]
    if (!list || !list.length || t < list[0]) return Infinity
    let lo = 0
    let hi = list.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (list[mid] <= t) lo = mid
      else hi = mid - 1
    }
    return t - list[lo]
  }

  /** Exponentially decaying pulse after each hit, in [0, 1]. */
  pulse(t, voice = 'kick', decay = 9) {
    const s = this.since(t, voice)
    return Number.isFinite(s) ? Math.exp(-s * decay) : 0
  }

  beatPhase(t) {
    const b = t / this.spb
    return b - Math.floor(b)
  }

  chordAt(t) {
    const bar = Math.floor(t / (this.spb * this.bpb))
    return this.data.chords[Math.min(Math.max(bar, 0), this.data.chords.length - 1)]
  }
}
