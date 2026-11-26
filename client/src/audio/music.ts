import { SOUND } from '../visualConfig.ts';
import type { AudioEngine } from './engine.ts';

/**
 * A small marching tune made on the fly: war drums, a low drone and a plucked lyre melody in
 * D dorian, with a horn now and then. Notes are scheduled a little ahead on the audio clock.
 */

/** D dorian, two octaves, as frequencies. */
const SCALE = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
const ROOT = 146.83;
const FIFTH = 220;
const STEPS_PER_BAR = 16;
const BARS_PER_PHRASE = 4;
/** Lyre phrases: scale degrees per eighth note, -1 for a rest. Picked from at random. */
const PHRASES: readonly (readonly number[])[] = [
  [7, -1, 9, 8, 7, 5, 4, -1, 5, 7, 8, -1, 7, 5, 4, 3],
  [4, 5, 7, -1, 7, 8, 9, 8, 7, -1, 5, 4, 5, -1, 4, -1],
  [9, -1, 8, 7, 8, -1, 7, 5, 7, 8, 9, 11, 9, -1, -1, -1],
  [0, 4, 7, -1, 4, 7, 9, -1, 7, 5, 4, 3, 4, -1, -1, -1],
];
/** War drum hits per 16th step in a bar: 2 = big drum, 1 = frame drum. */
const DRUMS = [2, 0, 0, 1, 0, 0, 2, 0, 2, 0, 0, 1, 0, 1, 0, 1];

export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private phrase: readonly number[] = PHRASES[0] ?? [];
  private drone: OscillatorNode[] = [];
  private readonly engine: AudioEngine;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  start(): void {
    const bus = this.engine.musicOut();
    if (!bus || this.timer) return;
    this.nextTime = bus.ctx.currentTime + SOUND.scheduleAhead;
    this.step = 0;
    this.startDrone(bus.ctx, bus.out);
    this.timer = setInterval(() => this.schedule(), SOUND.musicTickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const o of this.drone) o.stop();
    this.drone = [];
  }

  private startDrone(ctx: AudioContext, out: AudioNode): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    filter.connect(gain).connect(out);
    this.drone = [ROOT / 2, FIFTH / 2].map((freq) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.connect(filter);
      o.start();
      return o;
    });
  }

  private schedule(): void {
    const bus = this.engine.musicOut();
    if (!bus) {
      this.stop();
      return;
    }
    const sixteenth = 60 / SOUND.musicTempo / 4;
    while (this.nextTime < bus.ctx.currentTime + SOUND.musicLookahead) {
      this.playStep(bus.ctx, bus.out, this.nextTime);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(ctx: AudioContext, out: AudioNode, t: number): void {
    const inBar = this.step % STEPS_PER_BAR;
    const bar = Math.floor(this.step / STEPS_PER_BAR);
    if (inBar === 0 && bar % BARS_PER_PHRASE === 0) this.phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)] ?? this.phrase;
    const drum = DRUMS[inBar] ?? 0;
    if (drum === 2) this.bigDrum(ctx, out, t);
    else if (drum === 1) this.frameDrum(ctx, out, t);
    if (inBar % 2 === 0) {
      const degree = this.phrase[inBar / 2] ?? -1;
      const freq = SCALE[degree];
      if (freq !== undefined) this.lyre(ctx, out, t, freq);
    }
    if (inBar === 0 && bar % (BARS_PER_PHRASE * 2) === BARS_PER_PHRASE * 2 - 1) this.hornCall(ctx, out, t);
  }

  private bigDrum(ctx: AudioContext, out: AudioNode, t: number): void {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.45);
  }

  private frameDrum(ctx: AudioContext, out: AudioNode, t: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5, 0.1);
  }

  /** A plucked string: a bright attack that fades quickly. */
  private lyre(ctx: AudioContext, out: AudioNode, t: number, freq: number): void {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq * 2;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.75);
  }

  private hornCall(ctx: AudioContext, out: AudioNode, t: number): void {
    [ROOT * 2, FIFTH * 2, ROOT * 4].forEach((freq, i) => {
      const start = t + i * 0.35;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1100;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.12, start + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      o.connect(f).connect(g).connect(out);
      o.start(start);
      o.stop(start + 0.65);
    });
  }
}
