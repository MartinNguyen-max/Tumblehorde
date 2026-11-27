import type { AudioEngine, Voice } from './engine.ts';

/**
 * The soldiers speak no real language: cartoon gibberish. A soft, breathy voice slides between
 * syllables through three vowel filters, wobbles with vibrato and now and then squeaks. Every
 * soldier has a voice of their own (pitch and pace from their id), so a crowd sounds like a crowd.
 */

/** Formants (Hz) of a few vowels, nudged up for a small, cartoonish voice: a, e, i, o, u, æ. */
const VOWELS: readonly (readonly [number, number, number])[] = [
  [900, 1350, 2900],
  [620, 2050, 2900],
  [380, 2600, 3300],
  [650, 1000, 2800],
  [400, 950, 2600],
  [780, 1750, 2700],
];
const FORMANT_GAINS = [1, 0.55, 0.22];
const FORMANT_Q = 3.5;
/** Seconds for the pitch and the mouth to slide from one syllable to the next. */
const GLIDE = 0.035;
const ATTACK = 0.025;
const VIBRATO_RATE = 6.5;
const SQUEAK_CHANCE = 0.12;
const SQUEAK_FACTOR = 1.7;
const BREATH = 0.12;
const HARMONICS = 24;

export type Contour = 'flat' | 'rise' | 'fall' | 'wobble' | 'giggle';

export interface Babble {
  syllables: number;
  /** Base pitch (Hz). */
  pitch: number;
  /** Seconds per syllable. */
  rate: number;
  contour: Contour;
  loudness: number;
  /** How much the pitch wobbles (fraction of pitch). */
  vibrato: number;
  /** Stretch the last syllable: "waaaah", "yaaaay". */
  holdLast: number;
  /** Fixed vowel (index into VOWELS) for giggles and yells; random when absent. */
  vowel?: number;
}

/** A voice of one's own: soldier `id` speaks higher or lower, faster or slower. */
/** Vikings speak lower and rougher than legionaries. */
export function viking(b: Babble): Babble {
  return { ...b, pitch: b.pitch * VIKING_PITCH, vibrato: b.vibrato + VIKING_GRIT };
}

const VIKING_PITCH = 0.72;
const VIKING_GRIT = 0.03;

export function personal(b: Babble, id: number): Babble {
  const a = Math.sin(id * 12.9898) * 43758.5453;
  const r = a - Math.floor(a);
  return { ...b, pitch: b.pitch * (0.8 + r * 0.5), rate: b.rate * (0.85 + ((r * 7) % 1) * 0.35) };
}

let glottal: PeriodicWave | null = null;

/** A soft buzz with harmonics fading away: warmer and less robotic than a sawtooth. */
function glottalWave(ctx: AudioContext): PeriodicWave {
  if (glottal) return glottal;
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let n = 1; n < HARMONICS; n++) imag[n] = 1 / Math.pow(n, 1.6);
  glottal = ctx.createPeriodicWave(real, imag);
  return glottal;
}

function contourAt(contour: Contour, progress: number, i: number): number {
  switch (contour) {
    case 'flat':
      return 1 + (i % 2 === 0 ? 0.08 : -0.05);
    case 'rise':
      return 0.8 + progress * 0.75;
    case 'fall':
      return 1.45 - progress * 0.75;
    case 'wobble':
      return 1 + Math.sin(i * 2.3) * 0.22;
    case 'giggle':
      return 1.3 - progress * 0.35 + (i % 2) * 0.1;
  }
}

/** One phrase of gibberish. Returns its length in seconds. */
export function babble(engine: AudioEngine, v: Voice, b: Babble): number {
  const ctx = v.ctx;
  const source = ctx.createOscillator();
  source.setPeriodicWave(glottalWave(ctx));
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = VIBRATO_RATE * (0.9 + Math.random() * 0.2);
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = b.pitch * b.vibrato;
  vibrato.connect(vibratoDepth).connect(source.frequency);

  // A little breath through the same mouth makes it sound alive.
  const breath = ctx.createBufferSource();
  breath.buffer = engine.noiseBuffer(ctx);
  breath.loop = true;
  const breathGain = ctx.createGain();
  breathGain.gain.value = BREATH;

  const amp = ctx.createGain();
  amp.gain.value = 0;
  const formants = FORMANT_GAINS.map((gain) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = FORMANT_Q;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(filter);
    breath.connect(breathGain).connect(filter);
    filter.connect(level).connect(amp);
    return filter;
  });
  amp.connect(v.out);

  let t = v.t;
  source.frequency.setValueAtTime(b.pitch, t);
  for (let i = 0; i < b.syllables; i++) {
    const last = i === b.syllables - 1;
    const progress = b.syllables > 1 ? i / (b.syllables - 1) : 0;
    const length = b.rate * (0.7 + Math.random() * 0.6) * (last ? b.holdLast : 1);
    const vowel = VOWELS[b.vowel ?? Math.floor(Math.random() * VOWELS.length)] ?? VOWELS[0] ?? [900, 1350, 2900];
    const squeak = Math.random() < SQUEAK_CHANCE ? SQUEAK_FACTOR : 1;
    const pitch = b.pitch * contourAt(b.contour, progress, i) * squeak * (0.92 + Math.random() * 0.16);
    source.frequency.setTargetAtTime(pitch, t, GLIDE);
    formants.forEach((f, k) => f.frequency.setTargetAtTime(vowel[k] ?? 1000, t, GLIDE));
    amp.gain.setTargetAtTime(b.loudness, t, ATTACK);
    // Long held syllables sag at the end, like a real yell running out of breath.
    if (last && b.holdLast > 1) source.frequency.setTargetAtTime(pitch * 0.7, t + length * 0.5, length * 0.4);
    amp.gain.setTargetAtTime(0, t + length * 0.8, 0.02);
    if (Math.random() < 0.4) consonant(engine, v, t, b.loudness);
    t += length;
  }
  for (const node of [source, vibrato, breath]) {
    node.start(v.t);
    node.stop(t + 0.15);
  }
  return t - v.t;
}

/** A soft "t", "k" or "s" before a vowel. */
function consonant(engine: AudioEngine, v: Voice, t: number, loudness: number): void {
  const src = v.ctx.createBufferSource();
  src.buffer = engine.noiseBuffer(v.ctx);
  const f = v.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.5;
  f.frequency.value = 2500 + Math.random() * 3500;
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(loudness * 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  src.connect(f).connect(g).connect(v.out);
  src.start(t, Math.random() * 0.5, 0.035);
}

const A = 0;
const E = 1;
const I = 2;
const O = 3;

export const SAY = {
  /** The commander's speech: long, loud, wobbly, ending on a big held note. */
  speech: { syllables: 13, pitch: 200, rate: 0.13, contour: 'wobble', loudness: 0.6, vibrato: 0.03, holdLast: 4 },
  /** "Yaaaay!" */
  cheer: { syllables: 2, pitch: 320, rate: 0.12, contour: 'rise', loudness: 0.45, vibrato: 0.05, holdLast: 4, vowel: A },
  warCry: { syllables: 2, pitch: 290, rate: 0.12, contour: 'rise', loudness: 0.5, vibrato: 0.04, holdLast: 3.5, vowel: A },
  /** A Viking's roar: low, long and rough. "RRAAAAGH!" */
  roar: { syllables: 2, pitch: 150, rate: 0.14, contour: 'fall', loudness: 0.62, vibrato: 0.09, holdLast: 5, vowel: A },
  oof: { syllables: 1, pitch: 300, rate: 0.11, contour: 'fall', loudness: 0.45, vibrato: 0, holdLast: 1, vowel: O },
  /** "Waaaaah!", falling. */
  death: { syllables: 2, pitch: 420, rate: 0.12, contour: 'fall', loudness: 0.5, vibrato: 0.06, holdLast: 6, vowel: A },
  hic: { syllables: 1, pitch: 480, rate: 0.07, contour: 'rise', loudness: 0.4, vibrato: 0, holdLast: 1, vowel: I },
  /** "Hehehehe." */
  giggle: { syllables: 5, pitch: 380, rate: 0.075, contour: 'giggle', loudness: 0.35, vibrato: 0, holdLast: 1, vowel: E },
  drunk: { syllables: 5, pitch: 230, rate: 0.19, contour: 'wobble', loudness: 0.32, vibrato: 0.09, holdLast: 2.5 },
  chatter: { syllables: 4, pitch: 310, rate: 0.1, contour: 'flat', loudness: 0.22, vibrato: 0.02, holdLast: 1.3 },
  /** "Huh?" */
  huh: { syllables: 2, pitch: 260, rate: 0.13, contour: 'rise', loudness: 0.4, vibrato: 0, holdLast: 1.8 },
} as const satisfies Record<string, Babble>;
