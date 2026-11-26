import type { AudioEngine, Voice } from './engine.ts';

/**
 * Sound effects, each built from oscillators, noise and filters. Every function schedules its
 * nodes at `v.t` on `v.out` and lets them stop by themselves.
 */

function envelope(ctx: AudioContext, t: number, attack: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function noiseSource(engine: AudioEngine, v: Voice, length: number): AudioBufferSourceNode {
  const src = v.ctx.createBufferSource();
  src.buffer = engine.noiseBuffer(v.ctx);
  src.loopStart = Math.random() * 0.5;
  src.start(v.t, src.loopStart, length);
  return src;
}

/** Filtered noise with an envelope: whooshes, hisses, splashes, thuds' crack. */
function noiseBurst(engine: AudioEngine, v: Voice, filter: BiquadFilterType, from: number, to: number, attack: number, decay: number, peak: number): void {
  const src = noiseSource(engine, v, attack + decay + 0.05);
  const f = v.ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, v.t);
  f.frequency.exponentialRampToValueAtTime(to, v.t + attack + decay);
  const g = envelope(v.ctx, v.t, attack, peak, decay);
  src.connect(f).connect(g).connect(v.out);
}

/** A pitched tone sliding from one frequency to another. */
function tone(v: Voice, type: OscillatorType, from: number, to: number, attack: number, decay: number, peak: number, delay = 0): void {
  const o = v.ctx.createOscillator();
  o.type = type;
  const t = v.t + delay;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + attack + decay);
  const g = envelope(v.ctx, t, attack, peak, decay);
  o.connect(g).connect(v.out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

export function swing(engine: AudioEngine, v: Voice): void {
  noiseBurst(engine, v, 'bandpass', 500, 2400, 0.06, 0.16, 0.5);
}

/** Steel on steel, or on a shield rim: a bright ring of inharmonic partials. */
export function clang(engine: AudioEngine, v: Voice): void {
  const base = 600 + Math.random() * 300;
  for (const ratio of [1, 2.41, 3.77, 5.12]) tone(v, 'triangle', base * ratio, base * ratio * 0.98, 0.002, 0.35 / ratio + 0.08, 0.18 / ratio);
  noiseBurst(engine, v, 'highpass', 3000, 6000, 0.002, 0.05, 0.4);
}

/** A blow landing on a body: a low thump and a slap. */
export function thud(engine: AudioEngine, v: Voice): void {
  tone(v, 'sine', 140, 50, 0.004, 0.18, 0.9);
  noiseBurst(engine, v, 'lowpass', 1800, 300, 0.003, 0.08, 0.5);
}

/** A horse galloping into someone: a heavy double thump. */
export function trample(engine: AudioEngine, v: Voice): void {
  tone(v, 'sine', 110, 40, 0.004, 0.22, 1);
  tone(v, 'sine', 100, 38, 0.004, 0.2, 0.8, 0.09);
  noiseBurst(engine, v, 'lowpass', 900, 200, 0.004, 0.15, 0.6);
}

export function splash(engine: AudioEngine, v: Voice): void {
  noiseBurst(engine, v, 'bandpass', 3000, 500, 0.01, 0.45, 0.8);
  tone(v, 'sine', 500, 180, 0.005, 0.12, 0.25);
}

/** A thrown spear leaving the hand. */
export function throwWhoosh(engine: AudioEngine, v: Voice): void {
  noiseBurst(engine, v, 'bandpass', 300, 1600, 0.12, 0.25, 0.45);
}

/** A spear or arrow sticking into the ground. */
export function thunk(v: Voice): void {
  tone(v, 'square', 220, 90, 0.002, 0.08, 0.15);
  tone(v, 'sine', 160, 70, 0.002, 0.12, 0.3);
}

/** Wine being gulped: a few low bubbles. */
export function glug(v: Voice): void {
  for (let i = 0; i < 4; i++) tone(v, 'sine', 180 + Math.random() * 60, 90, 0.01, 0.09, 0.4, i * 0.13);
}

/** Two goblets clinking. */
export function clink(v: Voice): void {
  tone(v, 'sine', 2600, 2550, 0.002, 0.4, 0.25);
  tone(v, 'sine', 3900, 3850, 0.002, 0.25, 0.12);
}

/** A short bright horn call: orders, alliances, the end of the battle. */
export function horn(v: Voice, notes: readonly number[], step = 0.16): void {
  notes.forEach((note, i) => {
    const o = v.ctx.createOscillator();
    o.type = 'sawtooth';
    const t = v.t + i * step;
    o.frequency.setValueAtTime(note, t);
    const f = v.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(2200, t + 0.06);
    const g = envelope(v.ctx, t, 0.03, 0.35, step * 1.6);
    o.connect(f).connect(g).connect(v.out);
    o.start(t);
    o.stop(t + step * 1.8);
  });
}
