import type { AudioEngine, Voice } from './engine.ts';

/**
 * The soldiers speak no real language: a buzzy voice through two vowel filters babbles random
 * syllables, pitched up and bouncy, in the spirit of cartoon gibberish.
 */

/** First and second formant (Hz) of a few vowels, raised a little for a cartoon voice. */
const VOWELS: readonly [number, number][] = [
  [950, 1400],
  [650, 2200],
  [380, 2800],
  [700, 1050],
  [400, 1050],
  [800, 1700],
];

export type Contour = 'flat' | 'rise' | 'fall' | 'wobble';

export interface Babble {
  syllables: number;
  /** Base pitch (Hz): soldiers squeak, the commander is a bit lower. */
  pitch: number;
  /** Seconds per syllable. */
  rate: number;
  contour: Contour;
  loudness: number;
}

function contourAt(contour: Contour, progress: number, i: number): number {
  switch (contour) {
    case 'flat':
      return 1 + (i % 2 === 0 ? 0.06 : -0.04);
    case 'rise':
      return 0.85 + progress * 0.6;
    case 'fall':
      return 1.3 - progress * 0.55;
    case 'wobble':
      return 1 + Math.sin(i * 2.3) * 0.18;
  }
}

/** One phrase of gibberish. Returns its length in seconds. */
export function babble(engine: AudioEngine, v: Voice, b: Babble): number {
  const ctx = v.ctx;
  const source = ctx.createOscillator();
  source.type = 'sawtooth';
  const f1 = ctx.createBiquadFilter();
  const f2 = ctx.createBiquadFilter();
  for (const f of [f1, f2]) {
    f.type = 'bandpass';
    f.Q.value = 6;
  }
  const amp = ctx.createGain();
  amp.gain.value = 0;
  source.connect(f1).connect(amp);
  source.connect(f2).connect(amp);
  amp.connect(v.out);
  let t = v.t;
  for (let i = 0; i < b.syllables; i++) {
    const progress = b.syllables > 1 ? i / (b.syllables - 1) : 0;
    const length = b.rate * (0.75 + Math.random() * 0.5);
    const vowel = VOWELS[Math.floor(Math.random() * VOWELS.length)] ?? [700, 1200];
    const pitch = b.pitch * contourAt(b.contour, progress, i) * (0.93 + Math.random() * 0.14);
    source.frequency.setTargetAtTime(pitch, t, 0.015);
    f1.frequency.setTargetAtTime(vowel[0], t, 0.02);
    f2.frequency.setTargetAtTime(vowel[1], t, 0.02);
    amp.gain.setTargetAtTime(b.loudness, t, 0.012);
    amp.gain.setTargetAtTime(0, t + length * 0.78, 0.015);
    // Now and then a consonant: a tiny burst of hiss before the vowel.
    if (Math.random() < 0.5) consonant(engine, v, t, b.loudness);
    t += length;
  }
  source.start(v.t);
  source.stop(t + 0.1);
  return t - v.t;
}

function consonant(engine: AudioEngine, v: Voice, t: number, loudness: number): void {
  const src = v.ctx.createBufferSource();
  src.buffer = engine.noiseBuffer(v.ctx);
  const f = v.ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2500 + Math.random() * 3000;
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(loudness * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(f).connect(g).connect(v.out);
  src.start(t, Math.random() * 0.5, 0.04);
}

export const SAY = {
  /** The commander's speech: long, loud, a bit lower, rising to a cheer at the end. */
  speech: { syllables: 14, pitch: 210, rate: 0.13, contour: 'wobble', loudness: 0.55 },
  cheer: { syllables: 3, pitch: 330, rate: 0.14, contour: 'rise', loudness: 0.4 },
  warCry: { syllables: 4, pitch: 300, rate: 0.12, contour: 'rise', loudness: 0.45 },
  oof: { syllables: 1, pitch: 260, rate: 0.12, contour: 'fall', loudness: 0.45 },
  death: { syllables: 3, pitch: 360, rate: 0.16, contour: 'fall', loudness: 0.5 },
  hic: { syllables: 1, pitch: 420, rate: 0.08, contour: 'rise', loudness: 0.35 },
  drunk: { syllables: 5, pitch: 240, rate: 0.2, contour: 'wobble', loudness: 0.3 },
  chatter: { syllables: 4, pitch: 320, rate: 0.11, contour: 'flat', loudness: 0.22 },
  huh: { syllables: 2, pitch: 280, rate: 0.15, contour: 'rise', loudness: 0.4 },
} as const satisfies Record<string, Babble>;
