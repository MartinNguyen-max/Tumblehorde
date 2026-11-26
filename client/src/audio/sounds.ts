import type { AudioEngine, Voice } from './engine.ts';

/**
 * Cartoon sound effects, each built from oscillators, noise and filters: bonks, tinny clangs,
 * slide whistles, pops, bloops, kazoos and a burp. Every function schedules its nodes at `v.t`
 * on `v.out` and lets them stop by themselves.
 */

function envelope(ctx: AudioContext, t: number, attack: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

/** Filtered noise with an envelope: whooshes, hisses, splashes. */
function noiseBurst(engine: AudioEngine, v: Voice, filter: BiquadFilterType, from: number, to: number, attack: number, decay: number, peak: number, delay = 0): void {
  const t = v.t + delay;
  const src = v.ctx.createBufferSource();
  src.buffer = engine.noiseBuffer(v.ctx);
  src.start(t, Math.random() * 0.5, attack + decay + 0.05);
  const f = v.ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  src.connect(f).connect(envelope(v.ctx, t, attack, peak, decay)).connect(v.out);
}

/** A pitched tone sliding from one frequency to another. */
function tone(v: Voice, type: OscillatorType, from: number, to: number, attack: number, decay: number, peak: number, delay = 0): void {
  const o = v.ctx.createOscillator();
  o.type = type;
  const t = v.t + delay;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + attack + decay);
  o.connect(envelope(v.ctx, t, attack, peak, decay)).connect(v.out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

/** A tone with a wobble on it: whistles and kazoos. */
function wobblyTone(v: Voice, type: OscillatorType, from: number, to: number, length: number, peak: number, wobbleRate: number, wobbleDepth: number, delay = 0): OscillatorNode {
  const t = v.t + delay;
  const o = v.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + length);
  const lfo = v.ctx.createOscillator();
  lfo.frequency.value = wobbleRate;
  const depth = v.ctx.createGain();
  depth.gain.value = from * wobbleDepth;
  lfo.connect(depth).connect(o.frequency);
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
  g.gain.setValueAtTime(peak, t + length * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  o.connect(g).connect(v.out);
  for (const node of [o, lfo]) {
    node.start(t);
    node.stop(t + length + 0.05);
  }
  return o;
}

export function swing(engine: AudioEngine, v: Voice): void {
  noiseBurst(engine, v, 'bandpass', 600, 2600, 0.05, 0.14, 0.45);
}

/** A blow landing: a hollow wooden "bonk" and a soft thump. */
export function bonk(engine: AudioEngine, v: Voice): void {
  const pitch = 520 + Math.random() * 260;
  tone(v, 'sine', pitch, pitch * 0.55, 0.002, 0.11, 0.8);
  tone(v, 'triangle', pitch * 2.7, pitch * 1.5, 0.002, 0.05, 0.25);
  tone(v, 'sine', 130, 60, 0.004, 0.12, 0.6);
  noiseBurst(engine, v, 'lowpass', 1500, 300, 0.002, 0.05, 0.3);
}

/** A sword on a shield: a short tinny "tonk" rather than a church bell. */
export function clang(engine: AudioEngine, v: Voice): void {
  const base = 900 + Math.random() * 400;
  tone(v, 'square', base, base * 0.92, 0.002, 0.09, 0.12);
  tone(v, 'triangle', base * 1.5, base * 1.4, 0.002, 0.14, 0.12);
  noiseBurst(engine, v, 'highpass', 3500, 6000, 0.002, 0.03, 0.25);
}

/** Someone sent flying: a rising slide whistle. */
export function slideWhistle(v: Voice, rising: boolean): void {
  wobblyTone(v, 'sine', rising ? 500 : 1500, rising ? 1700 : 380, 0.55, 0.22, 9, 0.03);
}

/** A helmet popping off. */
export function pop(v: Voice): void {
  tone(v, 'sine', 500, 1400, 0.002, 0.07, 0.5);
}

/** A horse barging into someone: a heavy double thump and a "boing". */
export function trample(engine: AudioEngine, v: Voice): void {
  tone(v, 'sine', 110, 40, 0.004, 0.2, 0.9);
  tone(v, 'sine', 100, 38, 0.004, 0.18, 0.7, 0.09);
  wobblyTone(v, 'sine', 180, 260, 0.35, 0.25, 22, 0.25, 0.05);
  noiseBurst(engine, v, 'lowpass', 900, 200, 0.004, 0.15, 0.5);
}

/** Into the water: splash, then a bloop. */
export function splash(engine: AudioEngine, v: Voice): void {
  noiseBurst(engine, v, 'bandpass', 3000, 500, 0.01, 0.4, 0.7);
  tone(v, 'sine', 900, 250, 0.005, 0.18, 0.4, 0.05);
}

/** A thrown spear leaving the hand. */
export function throwWhoosh(engine: AudioEngine, v: Voice): void {
  noiseBurst(engine, v, 'bandpass', 300, 1800, 0.12, 0.22, 0.4);
}

/** A spear sticking into the ground: a twangy "thwong". */
export function thunk(v: Voice): void {
  tone(v, 'sine', 160, 70, 0.002, 0.1, 0.35);
  wobblyTone(v, 'triangle', 330, 300, 0.3, 0.12, 28, 0.08);
}

/** Wine being gulped. */
export function glug(v: Voice): void {
  for (let i = 0; i < 4; i++) tone(v, 'sine', 200 + Math.random() * 80, 90, 0.01, 0.1, 0.45, i * 0.14);
}

export function clink(v: Voice): void {
  tone(v, 'sine', 2600, 2550, 0.002, 0.4, 0.22);
  tone(v, 'sine', 3900, 3850, 0.002, 0.25, 0.1);
}

/** A long, rumbly burp. */
export function burp(engine: AudioEngine, v: Voice): void {
  const o = wobblyTone(v, 'sawtooth', 95, 70, 0.75, 0.35, 23, 0.25);
  const mouth = v.ctx.createBiquadFilter();
  mouth.type = 'lowpass';
  mouth.frequency.value = 650;
  o.disconnect();
  const g = envelope(v.ctx, v.t, 0.05, 0.5, 0.7);
  o.connect(mouth).connect(g).connect(v.out);
  noiseBurst(engine, v, 'lowpass', 400, 150, 0.05, 0.6, 0.15);
}

/** A kazoo: a buzzy tone through a nasal filter, a little wobbly. */
export function kazoo(v: Voice, notes: readonly number[], step: number, holdLast = 1): void {
  notes.forEach((note, i) => {
    const last = i === notes.length - 1;
    const length = step * (last ? holdLast : 0.9);
    const o = wobblyTone(v, 'sawtooth', note, last && holdLast > 1 ? note * 0.94 : note, length, 0.22, 6, last && holdLast > 1 ? 0.03 : 0.01, i * step);
    const nose = v.ctx.createBiquadFilter();
    nose.type = 'bandpass';
    nose.frequency.value = 1100;
    nose.Q.value = 1.8;
    const gain = v.ctx.createGain();
    gain.gain.value = 1.6;
    o.disconnect();
    const t = v.t + i * step;
    const g = envelope(v.ctx, t, 0.02, 0.35, length);
    o.connect(nose).connect(gain).connect(g).connect(v.out);
  });
}
