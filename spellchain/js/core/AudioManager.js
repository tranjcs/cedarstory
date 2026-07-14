import { ELEMENTS } from '../config.js';
import { rnd } from './math.js';

/**
 * Tiny procedural synth. Every game sound is an entry in the data-driven
 * SOUNDS table below and is triggered by id — callers publish
 * `sfx { id, ...data }` events and never touch WebAudio directly.
 * The AudioContext is created lazily on the first user-gesture-driven sound.
 */
const SOUNDS = {
  queued:        (a, d) => a.tone(ELEMENTS[d.element].tone, 0.11, 'sine', 0.16),
  combined:      (a, d) => a.tone(ELEMENTS[d.product].tone, 0.16, 'sine', 0.18, 120),
  cancelled:     (a) => a.tone(140, 0.14, 'sawtooth', 0.08, -60),
  rejected:      (a) => a.tone(120, 0.08, 'square', 0.06),
  undo:          (a) => a.tone(240, 0.08, 'triangle', 0.1),
  clear:         (a) => a.tone(180, 0.12, 'triangle', 0.1),
  spawn:         (a) => a.tone(300, 0.1, 'square', 0.06),
  dash:          (a) => a.tone(700, 0.12, 'sine', 0.1, -350),
  wall:          (a) => { a.tone(200, 0.25, 'triangle', 0.14, -80); a.noiseBurst(0.15, 0.08); },
  boulder:       (a) => a.tone(90, 0.3, 'sawtooth', 0.16, -40),
  boulderImpact: (a) => a.noiseBurst(0.25, 0.16),
  shards:        (a) => { a.tone(1200, 0.12, 'square', 0.08, -500); a.noiseBurst(0.08, 0.06); },
  area:          (a) => { a.tone(70, 0.4, 'sawtooth', 0.18, -30); a.noiseBurst(0.25, 0.14); },
  self:          (a, d) => a.tone(ELEMENTS[d.element].tone / 2, 0.2, 'sine', 0.14),
  beamStart:     (a, d) => a.tone(d.life ? 520 : 90, 0.3, 'sawtooth', 0.1, 40),
  beamLoop:      (a, d) => a.tone(d.life ? rnd(500, 560) : rnd(70, 90), 0.06, 'sawtooth', 0.03),
  sprayLoop:     (a) => a.tone(rnd(90, 140), 0.05, 'sawtooth', 0.02),
  zap:           (a) => a.tone(rnd(1800, 2400), 0.05, 'square', 0.04, -900),
  hit:           (a) => a.tone(rnd(160, 210), 0.07, 'square', 0.05),
  death:         (a) => a.noiseBurst(0.2, 0.1),
};

export class AudioManager {
  #ctx = null;
  #muted = false;

  /** @returns {boolean} the new muted state */
  toggleMute() {
    this.#muted = !this.#muted;
    return this.#muted;
  }

  /** Play a sound from the SOUNDS table by id. */
  play(id, data = {}) {
    SOUNDS[id]?.(this, data);
  }

  #ensureContext() {
    if (this.#muted) return null;
    if (!this.#ctx) {
      try {
        this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
    return this.#ctx;
  }

  tone(freq, dur = 0.12, type = 'sine', gain = 0.16, slide = 0) {
    const ctx = this.#ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur = 0.2, gain = 0.12) {
    const ctx = this.#ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const samples = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }
}
