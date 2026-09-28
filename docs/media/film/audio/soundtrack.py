#!/usr/bin/env python3
"""Rayburst promo soundtrack.

Every sound is synthesized from oscillators and filtered noise with numpy and
scipy. No samples, no generative model. The arrangement, drum patterns and
sound-effect cues are read from ../timeline.json, the same file the video
reads, so every hit lands on the frame it belongs to.

Outputs (default ../out):
  soundtrack.wav   48 kHz, 24-bit stereo master
  soundtrack.mid   MIDI score of the musical parts (drums on channel 10)
  stems/*.wav      drums / bass / music / sfx / fx-returns (with --stems)
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
TWO_PI = 2.0 * math.pi

PITCH_CLASSES = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
    "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}


# ── Pitch helpers ─────────────────────────────────────────────────────────


def mtof(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def parse_chord(name: str) -> tuple[int, list[int]]:
    """Return (root pitch class, chord intervals) for names like Dm, Bb, A7."""
    root = name[:2] if len(name) > 1 and name[1] in "#b" else name[:1]
    quality = name[len(root):]
    third = 3 if quality.startswith("m") else 4
    intervals = [0, third, 7]
    if "7" in quality:
        intervals.append(10)
    return PITCH_CLASSES[root], intervals


def chord_notes(name: str, low: int, high: int) -> list[int]:
    pc, intervals = parse_chord(name)
    pcs = {(pc + i) % 12 for i in intervals}
    return [n for n in range(low, high) if n % 12 in pcs]


# ── DSP building blocks ───────────────────────────────────────────────────


class DSP:
    def __init__(self, sr: int, seed: int = 20260926):
        self.sr = sr
        self.rng = np.random.default_rng(seed)
        self._sos_cache: dict[tuple, np.ndarray] = {}

    def time(self, dur: float) -> np.ndarray:
        return np.arange(max(1, int(round(dur * self.sr)))) / self.sr

    def noise(self, n: int) -> np.ndarray:
        return self.rng.standard_normal(n)

    # Oscillators take a frequency (scalar or per-sample array) and a length.
    def phase(self, freq, n: int, start: float = 0.0) -> np.ndarray:
        f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
        return (start + np.cumsum(f) / self.sr) % 1.0

    def sine(self, freq, n: int, start: float = 0.0) -> np.ndarray:
        return np.sin(TWO_PI * self.phase(freq, n, start))

    def saw(self, freq, n: int, start: float = 0.0) -> np.ndarray:
        """Band-limited sawtooth with a vectorised polyBLEP correction."""
        f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
        dt = np.clip(f / self.sr, 1e-9, 0.5)
        ph = (start + np.cumsum(dt)) % 1.0
        y = 2.0 * ph - 1.0
        lo = ph < dt
        x = ph[lo] / dt[lo]
        y[lo] -= x + x - x * x - 1.0
        hi = ph > 1.0 - dt
        x = (ph[hi] - 1.0) / dt[hi]
        y[hi] -= x * x + x + x + 1.0
        return y

    def square(self, freq, n: int, start: float = 0.0) -> np.ndarray:
        return np.sign(np.sin(TWO_PI * self.phase(freq, n, start)))

    # Filters
    def sos(self, kind: str, fc, order: int = 2) -> np.ndarray:
        key = (kind, tuple(np.atleast_1d(fc)), order)
        if key not in self._sos_cache:
            nyq = self.sr / 2.0
            wn = np.clip(np.asarray(fc, dtype=np.float64) / nyq, 1e-4, 0.999)
            self._sos_cache[key] = butter(order, wn, btype=kind, output="sos")
        return self._sos_cache[key]

    def lp(self, x, fc, order=2):
        return sosfilt(self.sos("lowpass", fc, order), x, axis=-1)

    def hp(self, x, fc, order=2):
        return sosfilt(self.sos("highpass", fc, order), x, axis=-1)

    def bp(self, x, lo, hi, order=2):
        return sosfilt(self.sos("bandpass", [lo, hi], order), x, axis=-1)

    def rbj_lowpass(self, fc: float, q: float) -> np.ndarray:
        w0 = TWO_PI * min(max(fc, 20.0), self.sr * 0.45) / self.sr
        alpha = math.sin(w0) / (2.0 * q)
        cw = math.cos(w0)
        a0 = 1.0 + alpha
        b0 = (1.0 - cw) / 2.0
        return np.array([[b0 / a0, (1.0 - cw) / a0, b0 / a0, 1.0, -2.0 * cw / a0, (1.0 - alpha) / a0]])

    def sweep_lp(self, x: np.ndarray, cutoff, q: float = 0.8, block: int = 256) -> np.ndarray:
        """Time-varying resonant low-pass. `cutoff(t)` maps seconds to Hz."""
        x = np.atleast_2d(x)
        n = x.shape[-1]
        y = np.empty_like(x)
        zi = np.zeros((1, x.shape[0], 2))
        starts = np.arange(0, n, block)
        fcs = cutoff((starts + block / 2) / self.sr)
        for i, fc in zip(starts, np.atleast_1d(fcs)):
            sos = self.rbj_lowpass(float(fc), q)
            y[:, i:i + block], zi = sosfilt(sos, x[:, i:i + block], axis=-1, zi=zi)
        return y[0] if y.shape[0] == 1 else y

    # Envelopes
    def adsr(self, n: int, a: float, d: float, s: float, r: float, gate: float) -> np.ndarray:
        t = np.arange(n) / self.sr
        env = np.where(t < a, t / max(a, 1e-6), s + (1.0 - s) * np.exp(-(t - a) / max(d, 1e-6)))
        rel = t >= gate
        if rel.any():
            level = env[min(int(gate * self.sr), n - 1)]
            env[rel] = level * np.exp(-(t[rel] - gate) / max(r, 1e-6))
        return env


# ── Instruments ───────────────────────────────────────────────────────────


class Instruments:
    def __init__(self, dsp: DSP):
        self.d = dsp

    # Drums
    def kick(self, gain=1.0):
        d = self.d
        t = d.time(0.5)
        f = 44.0 + 120.0 * np.exp(-t / 0.035)
        body = np.sin(TWO_PI * np.cumsum(f) / d.sr) * np.minimum(1, t / 0.0015) * np.exp(-t / 0.3)
        click = d.hp(d.noise(len(t)), 1800) * np.exp(-t / 0.004) * 0.25
        return np.tanh((body + click) * 1.7) * 0.9 * gain

    def clap(self, gain=1.0):
        d = self.d
        t = d.time(0.4)
        n = d.bp(d.noise(len(t)), 900, 3800)
        env = np.zeros_like(t)
        for off in (0.0, 0.011, 0.023):
            m = t >= off
            env[m] += np.exp(-(t[m] - off) / 0.0065)
        m = t >= 0.03
        env[m] += 0.55 * np.exp(-(t[m] - 0.03) / 0.1)
        return n * env * 0.5 * gain

    def metallic(self, n):
        d = self.d
        freqs = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)
        return sum(d.square(f * 1.7, n) for f in freqs) / len(freqs)

    def hat(self, open_=False, gain=1.0):
        d = self.d
        t = d.time(0.35 if open_ else 0.08)
        src = 0.6 * d.noise(len(t)) + 0.8 * self.metallic(len(t))
        src = d.hp(d.bp(src, 6000, 14000), 7000)
        env = np.exp(-t / (0.11 if open_ else 0.022)) * np.minimum(1, t / 0.0008)
        return src * env * (0.28 if open_ else 0.22) * gain

    def snare(self, gain=1.0):
        d = self.d
        t = d.time(0.25)
        tone = np.sin(TWO_PI * np.cumsum(185 + 60 * np.exp(-t / 0.02)) / d.sr) * np.exp(-t / 0.05)
        noise = d.bp(d.noise(len(t)), 1400, 7000) * np.exp(-t / 0.075)
        return (0.45 * tone + 0.7 * noise) * gain

    def rim(self, gain=1.0):
        d = self.d
        t = d.time(0.08)
        y = np.sin(TWO_PI * 1650 * t) * np.exp(-t / 0.012) + 0.4 * d.hp(d.noise(len(t)), 3000) * np.exp(-t / 0.006)
        return y * 0.35 * gain

    def tick(self, gain=1.0):
        d = self.d
        t = d.time(0.05)
        y = np.sin(TWO_PI * 2600 * t) * np.exp(-t / 0.006) + 0.5 * d.hp(d.noise(len(t)), 4000) * np.exp(-t / 0.003)
        return y * 0.3 * gain

    def crash(self, dur=2.6, gain=1.0):
        d = self.d
        t = d.time(dur)
        out = []
        for _ in range(2):
            src = 0.7 * d.noise(len(t)) + 0.5 * self.metallic(len(t))
            src = d.lp(d.hp(src, 3200), 12500)
            out.append(src * np.exp(-t / (dur * 0.33)) * np.minimum(1, t / 0.002))
        return np.stack(out) * 0.32 * gain

    # Tonal voices
    def supersaw(self, notes, dur, attack, release, cutoff, gain=1.0, voices=7, spread=0.16):
        d = self.d
        n = int((dur + release) * d.sr)
        out = np.zeros((2, n))
        detunes = np.linspace(-spread, spread, voices)
        for note in notes:
            f0 = mtof(note)
            for i, det in enumerate(detunes):
                ch = i % 2
                y = d.saw(f0 * 2.0 ** (det / 12.0), n, start=d.rng.random())
                out[ch] += y * (0.75 if i == voices // 2 else 0.55)
        out /= max(1, len(notes)) * voices * 0.35
        env = d.adsr(n, attack, 0.6, 0.85, release / 3, dur)
        out = d.sweep_lp(out, cutoff, q=0.7, block=512) * env
        return out * gain

    def pluck(self, note, dur=0.3, bright=1.0, gain=1.0):
        d = self.d
        t = d.time(dur)
        f = mtof(note)
        y = 0.6 * d.saw(f, len(t), d.rng.random()) + 0.4 * d.saw(f * 1.006, len(t), d.rng.random())
        y = d.sweep_lp(y, lambda s: 260 + 5200 * bright * np.exp(-s / 0.065), q=1.1, block=128)
        env = np.minimum(1, t / 0.002) * np.exp(-t / 0.15)
        return y * env * gain

    def bass(self, note, dur, gain=1.0, attack=0.004, release=0.05):
        d = self.d
        n = int((dur + release) * d.sr)
        f = mtof(note)
        sub = d.sine(f, n)
        mid = d.lp(d.saw(f, n), 1100, order=2)
        env = d.adsr(n, attack, 0.25, 0.8, release / 2, dur)
        y = np.tanh((0.75 * sub + 0.6 * mid) * 1.4)
        return y * env * 0.55 * gain

    def drone(self, note, dur, gain=1.0):
        d = self.d
        t = d.time(dur)
        f = mtof(note)
        y = d.sine(f, len(t)) + 0.3 * d.sine(f * 2.002, len(t)) + 0.12 * d.lp(d.saw(f, len(t)), 400)
        env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 0.8).clip(0, 1)
        return y * env * 0.35 * gain

    def fm(self, note, dur, ratio, index, decay, gain=1.0, attack=0.003, vibrato=0.0):
        d = self.d
        t = d.time(dur)
        f = mtof(note) * (1.0 + vibrato * np.sin(TWO_PI * 5.2 * t) * np.clip((t - 0.25) / 0.3, 0, 1))
        mod = np.sin(TWO_PI * np.cumsum(f * ratio) / d.sr)
        idx = index * np.exp(-t / (decay * 0.5)) + index * 0.12
        y = np.sin(TWO_PI * np.cumsum(f) / d.sr + idx * mod)
        env = np.minimum(1, t / attack) * np.exp(-t / decay)
        tail = np.clip((dur - t) / 0.05, 0, 1)
        return y * env * tail * gain

    def lead(self, note, beats, spb, gain=1.0):
        d = self.d
        gate = beats * spb
        dur = gate + 0.6
        t = d.time(dur)
        bell = self.fm(note, dur, 2.0, 2.2, 0.9, vibrato=0.004 if beats >= 1.5 else 0.0)
        f = mtof(note)
        body = d.saw(f, len(t), d.rng.random()) * 0.5 + d.saw(f * 0.5, len(t), d.rng.random()) * 0.2
        body = d.sweep_lp(body, lambda s: 700 + 2600 * np.exp(-s / 0.25), q=0.9, block=256)
        env = d.adsr(len(t), 0.006, 0.35, 0.55, 0.18, gate)
        return (0.55 * bell + 0.45 * body) * env * 0.5 * gain

    def gold_bell(self, note, dur=3.5, gain=1.0):
        a = self.fm(note, dur, 3.5, 3.2, 1.3)
        b = self.fm(note + 12, dur, 1.4, 1.5, 0.8) * 0.35
        return (a + b) * 0.45 * gain


# ── MIDI writer ───────────────────────────────────────────────────────────


class Midi:
    PPQ = 480

    def __init__(self, bpm: float):
        self.bpm = bpm
        self.tracks: dict[str, tuple[int, list]] = {}

    def note(self, track: str, channel: int, beat: float, beats: float, note: int, vel: float):
        if track not in self.tracks:
            self.tracks[track] = (channel, [])
        self.tracks[track][1].append((beat, beats, int(note), int(max(1, min(127, vel * 127)))))

    @staticmethod
    def _vlq(value: int) -> bytes:
        out = [value & 0x7F]
        value >>= 7
        while value:
            out.append((value & 0x7F) | 0x80)
            value >>= 7
        return bytes(reversed(out))

    def _chunk(self, events: list[tuple[int, bytes]]) -> bytes:
        events.sort(key=lambda e: e[0])
        data, last = b"", 0
        for tick, payload in events:
            data += self._vlq(tick - last) + payload
            last = tick
        data += b"\x00\xff\x2f\x00"
        return b"MTrk" + struct.pack(">I", len(data)) + data

    def save(self, path: Path):
        tempo = int(round(60_000_000 / self.bpm))
        chunks = [self._chunk([(0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")), (0, b"\xff\x58\x04\x04\x02\x18\x08")])]
        for name, (ch, notes) in self.tracks.items():
            evs = [(0, b"\xff\x03" + self._vlq(len(name)) + name.encode())]
            for beat, beats, note, vel in notes:
                on = int(round(beat * self.PPQ))
                off = on + max(1, int(round(beats * self.PPQ)))
                evs.append((on, bytes([0x90 | ch, note, vel])))
                evs.append((off, bytes([0x80 | ch, note, 0])))
            chunks.append(self._chunk(evs))
        header = b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), self.PPQ)
        path.write_bytes(header + b"".join(chunks))


# ── Song ──────────────────────────────────────────────────────────────────

BUSES = ("drums", "bass", "music", "lead", "sfx")
BUS_GAIN = {"drums": 0.8, "bass": 0.5, "music": 0.95, "lead": 0.95, "sfx": 0.68}
GM_DRUMS = {"kick": 36, "clap": 39, "snare": 38, "hat": 42, "ohat": 46, "rim": 37, "tick": 76}

MELODY_THEME = [  # (beat, note, beats) — the main theme over F C Dm Bb F C
    (0, 72, 1), (1, 69, 0.5), (1.5, 72, 0.5), (2, 77, 1.5),
    (4, 76, 1), (5, 74, 0.5), (5.5, 72, 0.5), (6, 67, 2),
    (8, 69, 0.5), (8.5, 74, 0.5), (9, 76, 1), (10, 77, 1), (11, 76, 0.5), (11.5, 74, 0.5),
    (12, 74, 1.5), (13.5, 77, 0.5), (14, 74, 2),
    (16, 72, 0.5), (16.5, 77, 0.5), (17, 79, 1), (18, 81, 2),
    (20, 79, 1), (21, 76, 1), (22, 72, 0.5), (22.5, 74, 0.5), (23, 76, 1),
]
# The "ray" motif: three rising notes, one per ray of the logo.
MOTIF_DROP = [(16, 69, 0.5), (16.5, 74, 0.5), (17, 76, 2.5), (20, 74, 1), (21, 77, 3)]
MOTIF_TEASE = [(13, 69, 0.5), (13.5, 74, 0.5), (14, 76, 1.5)]
MOTIF_GOLD = [(88.5, 69, 0.5), (89, 74, 0.5), (89.5, 76, 2.5), (93, 77, 1), (94, 74, 2),
              (97, 73, 1), (98, 76, 1), (99, 81, 1)]
MOTIF_FINAL = [(112, 69, 0.5), (112.5, 74, 0.5), (113, 76, 3), (116, 77, 1), (117, 74, 3),
               (120, 76, 1), (121, 79, 3), (124, 78, 0.5), (124.5, 81, 0.5), (125, 86, 5)]
ARP_STEPS = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3]


class Song:
    def __init__(self, timeline: dict, sr: int, end: float | None):
        self.tl = timeline
        self.sr = sr
        self.spb = 60.0 / timeline["bpm"]
        self.bpb = timeline["beatsPerBar"]
        self.steps = timeline["stepsPerBar"]
        self.duration = timeline["bars"] * self.bpb * self.spb
        self.length = min(end, self.duration) if end else self.duration
        self.n = int(round(self.length * sr))
        self.buses = {b: np.zeros((2, self.n), np.float32) for b in BUSES}
        self.rev = np.zeros((2, self.n), np.float32)
        self.dly = np.zeros((2, self.n), np.float32)
        self.kicks: list[float] = []
        self.d = DSP(sr)
        self.i = Instruments(self.d)
        self.midi = Midi(timeline["bpm"])
        self.chords = timeline["chords"]

    # Placement
    def beat_s(self, beat: float) -> float:
        return beat * self.spb

    def put(self, bus: str, sig: np.ndarray, t0: float, gain=1.0, pan=0.0, rev=0.0, dly=0.0):
        if t0 >= self.length:
            return
        sig = np.asarray(sig, dtype=np.float64)
        if sig.ndim == 1:
            angle = (np.clip(pan, -1, 1) + 1.0) * math.pi / 4.0
            sig = np.stack([sig * math.cos(angle), sig * math.sin(angle)]) * math.sqrt(2.0)
        elif pan:
            sig = sig * np.array([[min(1.0, 1.0 - pan)], [min(1.0, 1.0 + pan)]])
        sig = sig * gain
        i0 = int(round(t0 * self.sr))
        s0 = max(0, -i0)
        i0 = max(0, i0)
        i1 = min(self.n, i0 + sig.shape[1] - s0)
        if i1 <= i0:
            return
        chunk = sig[:, s0:s0 + (i1 - i0)].astype(np.float32)
        self.buses[bus][:, i0:i1] += chunk
        if rev:
            self.rev[:, i0:i1] += chunk * rev
        if dly:
            self.dly[:, i0:i1] += chunk * dly

    def chord_at(self, beat: float) -> str:
        bar = int(beat // self.bpb)
        return self.chords[min(bar, len(self.chords) - 1)]

    # Arrangement
    def drums(self):
        pats = self.tl["patterns"]
        inst = self.i
        voices = {
            "kick": (inst.kick, 0.72, 0.0, 0.0),
            "clap": (inst.clap, 0.8, 0.0, 0.12),
            "snare": (inst.snare, 0.55, 0.0, 0.1),
            "hat": (inst.hat, 0.7, 0.3, 0.0),
            "ohat": (lambda gain=1.0: inst.hat(True, gain), 0.8, -0.3, 0.06),
            "rim": (inst.rim, 0.8, 0.3, 0.2),
            "tick": (inst.tick, 0.8, 0.0, 0.1),
        }
        cache = {}
        for sec in self.tl["sections"]:
            for bi, pname in enumerate(sec["drums"]):
                bar_beat = sec["beat"] + bi * self.bpb
                for voice, steps in pats[pname].items():
                    fn, gain, pan, rev = voices[voice]
                    for step in steps:
                        beat = bar_beat + step * self.bpb / self.steps
                        t = self.beat_s(beat)
                        accent = 1.0 if step % 4 == 0 else 0.72
                        if voice == "hat":
                            accent *= 0.75 + 0.25 * ((step * 7919) % 5) / 4
                        key = voice
                        if key not in cache:
                            cache[key] = fn()
                        sig = cache[key]
                        if voice == "tick":
                            p = 0.35 if (step // 4) % 2 else -0.35
                            self.put("drums", sig, t, gain * accent, p, rev)
                        else:
                            self.put("drums", sig, t, gain * accent, pan, rev)
                        if voice == "kick":
                            self.kicks.append(t)
                        self.midi.note("Drums", 9, beat, 0.25, GM_DRUMS[voice], 0.8 * accent)

    def pad_bar(self, bar: int, gain: float, cutoff, attack=0.12, release=0.9, spread=0.16):
        chord = self.chords[bar]
        notes = chord_notes(chord, 55, 72)
        dur = self.bpb * self.spb
        sig = self.i.supersaw(notes, dur, attack, release, cutoff, gain, spread=spread)
        self.put("music", sig, self.beat_s(bar * self.bpb), 1.0, 0.0, rev=0.35)
        for nt in notes:
            self.midi.note("Pad", 1, bar * self.bpb, self.bpb, nt, 0.6 * gain)

    def arp_bar(self, bar: int, gain: float, bright: float | callable = 1.0, steps=range(16)):
        chord = self.chords[bar]
        tones = chord_notes(chord, 62, 90)[:5]
        while len(tones) < 5:
            tones.append(tones[-1] + 12)
        for s in steps:
            beat = bar * self.bpb + s * 0.25
            note = tones[ARP_STEPS[s]]
            b = bright(beat) if callable(bright) else bright
            vel = (1.0 if s % 4 == 0 else 0.7) * gain
            sig = self.i.pluck(note, 0.3, b, vel)
            self.put("music", sig, self.beat_s(beat), 1.0, 0.5 if s % 2 else -0.5, rev=0.2, dly=0.24)
            self.midi.note("Arp", 2, beat, 0.25, note, 0.7 * vel)

    def bass_bar(self, bar: int, gain: float, style: str):
        chord = self.chords[bar]
        pc, _ = parse_chord(chord)
        root = 36 + pc if pc >= 2 else 48 + pc  # keep roots between D2 and C#3
        if style == "hold":
            sig = self.i.bass(root, self.bpb * self.spb * 0.98, gain, attack=0.02, release=0.2)
            self.put("bass", sig, self.beat_s(bar * self.bpb))
            self.midi.note("Bass", 3, bar * self.bpb, self.bpb, root, 0.7)
            return
        for k in range(8):
            beat = bar * self.bpb + k * 0.5
            note = root + (12 if k in (3, 7) else 0)
            sig = self.i.bass(note, self.spb * 0.42, gain * (1.0 if k % 2 else 0.85))
            self.put("bass", sig, self.beat_s(beat))
            self.midi.note("Bass", 3, beat, 0.42, note, 0.75)

    def drone_bar(self, bar: int, bars: int, gain: float, note: int | None = None):
        if note is None:
            pc, _ = parse_chord(self.chords[bar])
            note = 38 + (pc - 2) % 12 - (12 if (pc - 2) % 12 > 6 else 0)
        sig = self.i.drone(note, bars * self.bpb * self.spb + 0.6, gain)
        self.put("bass", sig, self.beat_s(bar * self.bpb), rev=0.1)
        self.midi.note("Bass", 3, bar * self.bpb, bars * self.bpb, note, 0.5)

    def melody(self, notes, offset=0.0, gain=1.0, voice="lead"):
        for beat, note, beats in notes:
            b = beat + offset
            if voice == "gold":
                sig = self.i.gold_bell(note, 3.2, gain)
                self.put("lead", sig, self.beat_s(b), 1.0, 0.0, rev=0.55, dly=0.25)
            elif voice == "bell":
                sig = self.i.fm(note, beats * self.spb + 1.2, 2.0, 1.8, 0.9, gain * 0.45)
                self.put("lead", sig, self.beat_s(b), 1.0, 0.0, rev=0.5, dly=0.3)
            else:
                sig = self.i.lead(note, beats, self.spb, gain)
                self.put("lead", sig, self.beat_s(b), 1.0, 0.0, rev=0.3, dly=0.2)
            self.midi.note("Lead" if voice == "lead" else "Bells", 4 if voice == "lead" else 5, b, beats, note, 0.8 * gain)

    def arrange(self):
        """Per-section parts. Section names come from timeline.json."""
        spb, bpb = self.spb, self.bpb
        for sec in self.tl["sections"]:
            first = sec["beat"] // bpb
            bars = list(range(first, first + sec["beats"] // bpb))
            mode = sec["music"]

            if mode == "intro":
                self.drone_bar(first, len(bars), 0.7)
                for bar in bars:
                    self.pad_bar(bar, 0.9, lambda s: 900 + 250 * s, attack=0.9, release=1.2)

            elif mode == "build":
                start = self.beat_s(sec["beat"])
                span = sec["beats"] * spb
                for bar in bars:
                    t0 = self.beat_s(bar * bpb) - start
                    self.pad_bar(bar, 0.6, lambda s, t0=t0: 600 * (6.0 ** ((t0 + s) / span)), attack=0.2)
                    self.bass_bar(bar, 0.8, "hold")
                    self.arp_bar(bar, 0.5 + 0.3 * (bar - first), lambda b: 0.25 + 0.75 * ((b - sec["beat"]) / sec["beats"]))
                self.melody(MOTIF_TEASE, gain=0.75, voice="bell")

            elif mode == "drop":
                for bar in bars:
                    self.pad_bar(bar, 0.85, lambda s: 7500 + 0 * s, attack=0.01)
                    self.bass_bar(bar, 1.0, "eighths")
                    self.arp_bar(bar, 0.7)
                self.melody(MOTIF_DROP, gain=1.0)

            elif mode == "slam":
                # Protocol slams: bass and drums only, the slams carry the chords;
                # plucks return as the links type in, then the full groove.
                for k, bar in enumerate(bars):
                    if k < 2:
                        self.bass_bar(bar, 1.0, "eighths")
                        if k == 1:
                            self.arp_bar(bar, 0.55, lambda b: 0.5 + 0.5 * ((b % bpb) / bpb), steps=range(8, 16))
                    else:
                        self.pad_bar(bar, 0.6, lambda s: 4800 + 0 * s)
                        self.bass_bar(bar, 0.95, "eighths")
                        self.arp_bar(bar, 0.8)

            elif mode == "groove":
                for bar in bars:
                    self.pad_bar(bar, 0.6, lambda s: 4800 + 0 * s)
                    self.bass_bar(bar, 0.95, "eighths")
                    self.arp_bar(bar, 0.8)

            elif mode == "theme":
                for bar in bars:
                    self.pad_bar(bar, 0.5, lambda s: 3800 + 0 * s)
                    self.bass_bar(bar, 0.95, "eighths")
                    self.arp_bar(bar, 0.5, 0.8)
                self.melody(MELODY_THEME, offset=sec["beat"], gain=0.95)

            elif mode == "lift":
                for k, bar in enumerate(bars):
                    self.pad_bar(bar, 0.6, lambda s: 4200 + 0 * s, attack=0.3 if k < 2 else 0.1)
                    self.bass_bar(bar, 0.85, "hold" if k < 2 else "eighths")
                    self.arp_bar(bar, 0.55 if k < 2 else 0.75, 0.7 if k < 2 else 1.0)
                self.melody(MELODY_THEME[:16], offset=sec["beat"] + 2 * bpb, gain=0.85)

            elif mode == "breakdown":
                self.drone_bar(first, len(bars), 0.6, note=38)  # D pedal under Gm, Bb, A
                for k, bar in enumerate(bars):
                    self.pad_bar(bar, 0.55, lambda s: 1300 + 300 * s, attack=0.6, release=1.4, spread=0.1)
                    if k == len(bars) - 1:
                        self.arp_bar(bar, 0.6, lambda b: 0.2 + 0.8 * ((b % bpb) / bpb))
                self.melody(MOTIF_GOLD, gain=0.9, voice="gold")

            elif mode == "finale":
                for k, bar in enumerate(bars):
                    if k < 3:
                        self.pad_bar(bar, 0.85, lambda s: 7500 + 0 * s, attack=0.01)
                        self.bass_bar(bar, 1.0, "eighths")
                        self.arp_bar(bar, 0.7)
                # Final D major chord, held until the end with a long release.
                final_bar = bars[3]
                hold = (len(bars) - 3) * bpb * spb
                notes = chord_notes("D", 50, 76)
                sig = self.i.supersaw(notes, hold - 2.2, 0.02, 2.5, lambda s: 5000 * np.exp(-s / 3.5) + 700, 0.95)
                self.put("music", sig, self.beat_s(final_bar * bpb), 1.0, rev=0.5)
                bass = self.i.bass(38, hold - 2.2, 1.0, attack=0.01, release=1.5)
                self.put("bass", bass, self.beat_s(final_bar * bpb))
                for nt in notes:
                    self.midi.note("Pad", 1, final_bar * bpb, hold / spb, nt, 0.8)
                self.midi.note("Bass", 3, final_bar * bpb, hold / spb, 38, 0.8)
                self.melody(MOTIF_FINAL, gain=1.0)
            else:
                raise ValueError(f"Unknown music mode: {mode}")

    # Sound effects
    def sfx(self):
        d, inst, spb = self.d, self.i, self.spb
        for name, ev in self.tl["events"].items():
            kind = ev.get("sfx")
            if not kind:
                continue
            t = self.beat_s(ev["beat"])
            g = ev.get("gain", 1.0)
            pan = ev.get("pan", 0.0)
            length = ev.get("len", 1.0) * spb
            note = ev.get("note", 81)
            maker = getattr(self, f"fx_{kind}", None)
            if maker is None:
                raise ValueError(f"Event {name}: unknown sfx '{kind}'")
            maker(t, g, pan, length, note)

    def fx_glitch(self, t, g, pan, length, note):
        d = self.d
        seq = (1760, 1320, 880, 1320, 660)
        for k, f in enumerate(seq):
            tt = d.time(0.028)
            y = d.square(f, len(tt)) * np.exp(-tt / 0.02)
            y = np.round(y * 6) / 6
            y = np.repeat(y[::6], 6)[:len(tt)]
            self.put("sfx", y * 0.25, t + k * 0.034, g, pan + (0.3 if k % 2 else -0.3), rev=0.1)

    def fx_spark(self, t, g, pan, length, note):
        d = self.d
        tt = d.time(0.6)
        f = 900 * (4.6 ** np.clip(tt / 0.35, 0, 1))
        y = np.sin(TWO_PI * np.cumsum(f) / d.sr) * np.exp(-tt / 0.22) * np.minimum(1, tt / 0.01)
        y += d.hp(d.noise(len(tt)), 6000) * np.exp(-tt / 0.08) * 0.4
        self.put("sfx", y * 0.35, t, g, pan, rev=0.5)

    def fx_riser(self, t, g, pan, length, note):
        d = self.d
        tt = d.time(length)
        x = tt / length
        noise = d.noise(len(tt))
        y = d.sweep_lp(noise, lambda s: 250 * (40 ** np.clip(s / length, 0, 1)), q=2.5, block=512)
        y = d.hp(y, 150)
        f = mtof(50) * (2.0 ** (x * 2))
        tone = d.saw(f, len(tt)) + d.saw(f * 1.498, len(tt))
        tone = d.lp(tone, 3000) * 0.25
        env = x ** 2.2 * np.clip((length - tt) / 0.02, 0, 1)
        self.put("sfx", (0.6 * y + tone) * env * 0.5, t, g, pan, rev=0.3)

    def fx_roll(self, t, g, pan, length, note):
        hit = self.i.snare()
        beats = length / self.spb
        k, b = 0, 0.0
        while b < beats - 1e-6:
            step = 0.25 if b < beats / 2 else 0.125
            vel = 0.3 + 0.7 * (b / beats)
            self.put("drums", hit, t + b * self.spb, g * vel, pan + (0.15 if k % 2 else -0.15), rev=0.1)
            b += step
            k += 1

    def fx_impact(self, t, g, pan, length, note, big=True):
        d = self.d
        dur = 3.0 if big else 1.4
        tt = d.time(dur)
        f = 27 + 45 * np.exp(-tt / 0.22)
        boom = np.sin(TWO_PI * np.cumsum(f) / d.sr) * np.exp(-tt / (1.3 if big else 0.6)) * np.minimum(1, tt / 0.002)
        crack = d.hp(d.noise(len(tt)), 500) * np.exp(-tt / 0.07) * 0.5
        tom = np.sin(TWO_PI * np.cumsum(90 * np.exp(-tt / 0.4) + 50) / d.sr) * np.exp(-tt / 0.3) * 0.4
        y = np.tanh((boom * 1.2 + crack + tom) * 1.3)
        self.put("sfx", y * 0.8, t, g, pan, rev=0.35 if big else 0.25)
        if big:
            self.put("drums", self.i.crash(3.2), t, g * 0.9, rev=0.3)

    def fx_impactSoft(self, t, g, pan, length, note):
        self.fx_impact(t, g, pan, length, note, big=False)

    def _whoosh(self, dur, peak, lo, hi):
        d = self.d
        tt = d.time(dur)
        x = tt / dur
        shape = np.where(x < peak, x / peak, (1 - x) / (1 - peak))
        y = d.sweep_lp(d.noise(len(tt)), lambda s: lo + (hi - lo) * np.interp(s / dur, [0, peak, 1], [0, 1, 0.15]), q=1.8, block=256)
        env = np.sin(np.clip(shape, 0, 1) * math.pi / 2) ** 2
        return y * env, x

    def fx_swish(self, t, g, pan, length, note):
        y, x = self._whoosh(0.32, 0.55, 1200, 7000)
        left, right = y * (1 - x), y * x
        self.put("sfx", np.stack([left, right]) * 0.35, t, g, rev=0.15)

    def fx_whoosh(self, t, g, pan, length, note):
        y, x = self._whoosh(0.9, 0.62, 300, 5500)
        left, right = y * np.clip(1.2 - x, 0, 1), y * np.clip(x + 0.2, 0, 1)
        self.put("sfx", np.stack([left, right]) * 0.55, t - 0.45, g, rev=0.2)

    def fx_slam(self, t, g, pan, length, note):
        """A protocol slam: air rushing in, a sub drop, a crack and a chord stab."""
        d, inst = self.d, self.i
        pre, x = self._whoosh(0.16, 0.9, 800, 9000)
        self.put("sfx", np.stack([pre, pre]) * 0.35, t - 0.15, g, rev=0.1)
        tt = d.time(0.7)
        f = 38 + 90 * np.exp(-tt / 0.05)
        sub = np.sin(TWO_PI * np.cumsum(f) / d.sr) * np.exp(-tt / 0.28) * np.minimum(1, tt / 0.002)
        crack = d.hp(d.noise(len(tt)), 1800) * np.exp(-tt / 0.03) * 0.45
        self.put("sfx", np.tanh((sub * 1.3 + crack) * 1.4) * 0.5, t, g, pan, rev=0.2)
        chord = self.chord_at(t / self.spb)
        notes = sorted(set(chord_notes(chord, 55, 76) + [note]))
        stab = inst.supersaw(notes, 0.16, 0.003, 0.35, lambda s: 1200 + 8500 * np.exp(-s / 0.07), 0.95, spread=0.2)
        self.put("music", stab, t, g * 0.6, pan, rev=0.35, dly=0.15)
        self.midi.note("Stabs", 6, t / self.spb, 0.5, int(note), 0.9)

    def fx_type(self, t, g, pan, length, note):
        """A link lands in the URL box: key tick plus a small pitched pluck."""
        d = self.d
        tt = d.time(0.04)
        key = d.hp(d.noise(len(tt)), 3500) * np.exp(-tt / 0.004) * 0.5 + np.sin(TWO_PI * 1900 * tt) * np.exp(-tt / 0.006) * 0.25
        side = 0.3 if int(note) % 2 else -0.3
        self.put("sfx", key, t, g, side)
        self.put("sfx", self.i.pluck(int(note), 0.35, 1.2, 0.5), t, g, side * 0.5, rev=0.3, dly=0.2)
        sw, x = self._whoosh(0.22, 0.85, 2000, 9000)
        self.put("sfx", np.stack([sw * (1 - x), sw * x]) * 0.18, t - 0.19, g)

    def fx_chip(self, t, g, pan, length, note):
        d = self.d
        bell = self.i.fm(note, 0.9, 2.0, 1.6, 0.35) * 0.3
        tt = d.time(0.06)
        thud = np.sin(TWO_PI * 160 * tt) * np.exp(-tt / 0.018) * 0.5
        click = d.hp(d.noise(len(tt)), 3000) * np.exp(-tt / 0.003) * 0.25
        self.put("sfx", bell, t, g, pan, rev=0.35, dly=0.2)
        self.put("sfx", thud + click, t, g * 0.8, pan)

    def fx_pop(self, t, g, pan, length, note):
        d = self.d
        tt = d.time(0.09)
        f = mtof(note) * 0.5 * (1 + 0.6 * np.clip(tt / 0.05, 0, 1))
        y = np.sin(TWO_PI * np.cumsum(f) / d.sr) * np.exp(-tt / 0.03) * np.minimum(1, tt / 0.002)
        self.put("sfx", y * 0.5, t, g, pan, rev=0.15)

    def fx_ding(self, t, g, pan, length, note):
        y = self.i.fm(note, 1.6, 3.0, 1.2, 0.6) * 0.3 + self.i.fm(note + 7, 1.6, 2.0, 0.8, 0.5) * 0.12
        self.put("sfx", y, t, g, pan, rev=0.45, dly=0.25)

    def fx_complete(self, t, g, pan, length, note):
        a = self.i.fm(81, 1.2, 2.0, 1.0, 0.5) * 0.28
        b = self.i.fm(86, 1.4, 2.0, 1.0, 0.6) * 0.3
        self.put("sfx", a, t, g, pan - 0.1, rev=0.4)
        self.put("sfx", b, t + 0.09, g, pan + 0.1, rev=0.4)

    def fx_click(self, t, g, pan, length, note):
        d = self.d
        tt = d.time(0.03)
        y = d.hp(d.noise(len(tt)), 2500) * np.exp(-tt / 0.0025) * 0.6 + np.sin(TWO_PI * 3200 * tt) * np.exp(-tt / 0.004) * 0.4
        self.put("sfx", y * 0.6, t, g, pan)

    def fx_tick(self, t, g, pan, length, note):
        self.put("sfx", self.i.tick(1.6), t, g, pan, rev=0.2)

    def fx_beam(self, t, g, pan, length, note):
        d = self.d
        tt = d.time(length + 0.4)
        x = np.clip(tt / length, 0, 1)
        shimmer = np.zeros_like(tt)
        for k, nt in enumerate((74, 77, 81, 86, 89)):
            shimmer += np.sin(TWO_PI * mtof(nt) * (1 + 0.5 * x) * tt + k) * (0.5 + 0.5 * np.sin(TWO_PI * (7 + k) * tt))
        shimmer /= 5
        air = d.sweep_lp(d.noise(len(tt)), lambda s: 800 * (8 ** np.clip(s / length, 0, 1)), q=1.5, block=256)
        env = x ** 1.6 * np.clip((length + 0.35 - tt) / 0.35, 0, 1)
        y = (0.35 * shimmer + 0.4 * air) * env
        pan_curve = -0.7 + 1.4 * x
        left, right = y * np.cos((pan_curve + 1) * math.pi / 4), y * np.sin((pan_curve + 1) * math.pi / 4)
        self.put("sfx", np.stack([left, right]) * 0.9, t, g, rev=0.35)

    def fx_arrive(self, t, g, pan, length, note):
        for k, nt in enumerate((74, 77, 81, 86)):
            self.put("sfx", self.i.fm(nt, 1.8, 2.0, 1.4, 0.8) * 0.16, t + k * 0.03, g, 0.5, rev=0.5)
        self.fx_impact(t, g * 0.55, 0.4, length, note, big=False)

    def fx_gold(self, t, g, pan, length, note):
        self.put("sfx", self.i.gold_bell(50, 4.5, 0.9), t, g, pan, rev=0.6)
        self.put("sfx", self.i.gold_bell(62, 4.0, 0.5), t + 0.02, g, pan, rev=0.6, dly=0.3)
        self.fx_impact(t, g * 0.5, pan, length, note, big=False)

    def fx_cut(self, t, g, pan, length, note):
        d = self.d
        tt = d.time(0.14)
        thump = np.sin(TWO_PI * np.cumsum(60 + 90 * np.exp(-tt / 0.02)) / d.sr) * np.exp(-tt / 0.05)
        snap = d.bp(d.noise(len(tt)), 1500, 8000) * np.exp(-tt / 0.02) * 0.5
        self.put("sfx", (thump + snap) * 0.55, t, g, pan, rev=0.12)

    def fx_crash(self, t, g, pan, length, note):
        self.put("drums", self.i.crash(3.0), t, g, pan, rev=0.25)

    def fx_reverse(self, t, g, pan, length, note):
        c = self.i.crash(length * 1.6)[:, ::-1]
        c = c[:, -int(length * self.sr):]
        fade = np.clip(np.linspace(0, 1, c.shape[1]) * 3, 0, 1)
        self.put("sfx", c * fade * 1.6, t, g, pan, rev=0.2)

    # Mixing
    def sidechain(self) -> np.ndarray:
        duck = np.ones(self.n, np.float32)
        win = int(0.45 * self.sr)
        tt = np.arange(win) / self.sr
        shape = (1 - np.exp(-tt / 0.004)) * np.exp(-tt / 0.13)
        shape = (shape / shape.max()).astype(np.float32)
        for k in self.kicks:
            i0 = int(round(k * self.sr))
            if i0 >= self.n:
                continue
            i1 = min(self.n, i0 + win)
            seg = 1.0 - shape[: i1 - i0]
            duck[i0:i1] = np.minimum(duck[i0:i1], seg)
        return duck

    def gaps(self) -> np.ndarray:
        """Near-silence before drops: events with a "gap" (beats) mute the music buses."""
        gate = np.ones(self.n)
        ramp = int(0.006 * self.sr)
        for ev in self.tl["events"].values():
            if "gap" not in ev:
                continue
            i0 = int(round(self.beat_s(ev["beat"]) * self.sr))
            i1 = int(round(self.beat_s(ev["beat"] + ev["gap"]) * self.sr))
            if i0 >= self.n:
                continue
            i1 = min(i1, self.n)
            gate[i0:i1] = 0.08
            k = min(ramp, i0)
            gate[i0 - k:i0] = np.minimum(gate[i0 - k:i0], np.linspace(1, 0.08, k))
            k = min(ramp, self.n - i1)
            gate[i1:i1 + k] = np.minimum(gate[i1:i1 + k], np.linspace(0.08, 1, k))
        return gate

    def reverb_ir(self) -> np.ndarray:
        d = self.d
        tt = d.time(3.0)
        chans = []
        for _ in range(2):
            n = d.lp(d.noise(len(tt)), 6500) * np.exp(-tt / 0.55)
            n[: int(0.018 * self.sr)] = 0.0
            chans.append(n)
        ir = np.stack(chans)
        return ir / np.sqrt(np.sum(ir ** 2) / 2)

    def delay_returns(self) -> np.ndarray:
        d = self.d
        src = d.lp(self.dly.astype(np.float64), 3500)
        out = np.zeros_like(src)
        step = int(round(0.75 * self.spb * self.sr))  # dotted eighth
        for k in range(1, 7):
            shift = step * k
            if shift >= self.n:
                break
            gain = 0.42 ** k
            src_ch, dst_ch = (0, 1) if k % 2 else (1, 0)
            out[dst_ch, shift:] += src[src_ch, : self.n - shift] * gain
            out[src_ch, shift:] += src[src_ch, : self.n - shift] * gain * 0.35
        return out

    def render(self):
        self.drums()
        self.arrange()
        self.sfx()
        duck = self.sidechain()
        stems = {}
        for bus in BUSES:
            sig = self.buses[bus].astype(np.float64) * BUS_GAIN[bus]
            if bus == "bass":
                sig *= 1.0 - 0.6 * (1.0 - duck)
            elif bus == "music":
                sig *= 1.0 - 0.42 * (1.0 - duck)
            elif bus == "lead":
                sig *= 1.0 - 0.2 * (1.0 - duck)
            stems[bus] = sig
        ir = self.reverb_ir()
        rev = np.stack([fftconvolve(self.rev[c].astype(np.float64), ir[c])[: self.n] for c in range(2)])
        stems["returns"] = rev * 0.42 + self.delay_returns() * 0.55
        gate = self.gaps()
        for k in ("drums", "bass", "music", "lead", "returns"):
            stems[k] = stems[k] * gate
        mix = sum(stems.values())
        mix = self.d.hp(mix, 28)
        # Gentle tilt: lift air above ~3.5 kHz so the mix reads on small speakers.
        mix = mix + 0.45 * self.d.hp(mix, 3500)
        # Loudness: bring the body of the mix to a consistent level, then soft clip.
        rms = np.sqrt(np.mean(mix ** 2) + 1e-12)
        drive = 0.19 / rms
        master = np.tanh(mix * drive * 1.1) / 1.1
        peak = np.max(np.abs(master)) + 1e-12
        norm = 10 ** (-1.0 / 20) / peak
        master *= norm
        fade = int(0.5 * self.sr)
        master[:, -fade:] *= np.linspace(1, 0, fade)
        for k in stems:
            stems[k] = stems[k] * drive * norm
        return master, stems


# ── Output ────────────────────────────────────────────────────────────────


def write_wav(path: Path, data: np.ndarray, sr: int):
    data = np.clip(data, -1.0, 1.0)
    dither = (np.random.default_rng(1).random(data.shape) - np.random.default_rng(2).random(data.shape)) / 8388607
    ints = np.round((data + dither) * 8388607).astype("<i4")
    inter = ints.T.reshape(-1)
    raw = inter.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(sr)
        w.writeframes(raw)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--timeline", default=str(ROOT / "timeline.json"))
    ap.add_argument("--out", default=str(ROOT / "out"))
    ap.add_argument("--sr", type=int, default=48000)
    ap.add_argument("--end", type=float, default=None, help="render only the first N seconds (quick checks)")
    ap.add_argument("--stems", action="store_true", help="also write per-bus stems")
    args = ap.parse_args()

    timeline = json.loads(Path(args.timeline).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    song = Song(timeline, args.sr, args.end)
    master, stems = song.render()
    write_wav(out / "soundtrack.wav", master, args.sr)
    song.midi.save(out / "soundtrack.mid")
    if args.stems:
        (out / "stems").mkdir(exist_ok=True)
        for name, sig in stems.items():
            write_wav(out / "stems" / f"{name}.wav", sig, args.sr)

    peak = 20 * np.log10(np.max(np.abs(master)) + 1e-12)
    rms = 20 * np.log10(np.sqrt(np.mean(master ** 2)) + 1e-12)
    print(f"soundtrack.wav  {song.length:.2f}s  {args.sr} Hz  peak {peak:.1f} dBFS  rms {rms:.1f} dBFS")
    print(f"soundtrack.mid  {sum(len(v[1]) for v in song.midi.tracks.values())} notes")


if __name__ == "__main__":
    main()
