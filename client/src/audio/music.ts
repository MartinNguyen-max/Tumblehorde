import type { MusicCue } from '../cinematic/script.ts';

/**
 * Soft, warm music for cutscenes only, synthesized on the fly: a slow pad, a plucked lyre, a
 * wordless choir and a low drone, all through one shared hall reverb. The monastery melody comes
 * back through the story, in major when life is good and in minor when it is not.
 */

type Instrument = 'pad' | 'lyre' | 'choir' | 'drone';

/** A note: semitones from A4 (0 = 440 Hz), and length in beats. Null pitch is a rest. */
type Note = readonly [number | null, number];

interface Piece {
  bpm: number;
  /** Chords as semitone lists, one per bar. */
  chords: readonly (readonly number[])[];
  beatsPerChord: number;
  melody: readonly Note[] | null;
  melodyOn: Instrument | null;
  chordsOn: readonly Instrument[];
  level: number;
}

const D4 = -7;
const E4 = -5;
const F4 = -4;
const FS4 = -3;
const G4 = -2;
const A4 = 0;
const B4 = 2;
const BB4 = 1;
const C5 = 3;
const D5 = 5;

/** The monastery melody: simple, rising and coming home. */
const MONASTERY_THEME: readonly Note[] = [
  [A4, 2], [B4, 1], [A4, 1], [FS4, 2], [D4, 2],
  [E4, 1], [FS4, 1], [G4, 2], [FS4, 1], [E4, 1], [D4, 4],
  [FS4, 1], [G4, 1], [A4, 2], [D5, 2], [C5, 1], [B4, 1],
  [A4, 2], [G4, 1], [FS4, 1], [E4, 2], [D4, 4], [null, 2],
];

/** The same melody in minor, slower, with a missing note where the voice breaks. */
const SORROW_THEME: readonly Note[] = [
  [A4, 2], [BB4, 1], [A4, 1], [F4, 2], [D4, 2],
  [E4, 1], [F4, 1], [G4, 2], [F4, 1], [E4, 1], [D4, 4],
  [null, 2], [F4, 1], [G4, 1], [A4, 3], [null, 1], [G4, 1], [F4, 1], [E4, 2], [D4, 6], [null, 2],
];

const D_MAJOR = [-19, -12, -7, -3, 0];
const G_MAJOR = [-14, -7, -2, 2, 5];
const A_MAJOR = [-12, -5, 0, 4, 7];
const B_MINOR = [-22, -10, -3, 2, 5];
const D_MINOR = [-19, -12, -7, -4, 0];
const BB_MAJOR = [-23, -11, -7, -2, 1];
const G_MINOR = [-14, -7, -2, 1, 5];
const A_SUS = [-12, -5, 0, 2, 7];

const PIECES: Record<Exclude<MusicCue, 'silence'>, Piece> = {
  monastery: {
    bpm: 72, chords: [D_MAJOR, G_MAJOR, D_MAJOR, A_MAJOR, B_MINOR, G_MAJOR, D_MAJOR, A_SUS], beatsPerChord: 4,
    melody: MONASTERY_THEME, melodyOn: 'lyre', chordsOn: ['pad', 'choir'], level: 0.55,
  },
  warm: {
    bpm: 66, chords: [D_MAJOR, B_MINOR, G_MAJOR, A_MAJOR], beatsPerChord: 4,
    melody: null, melodyOn: null, chordsOn: ['pad', 'lyre'], level: 0.5,
  },
  sorrow: {
    bpm: 54, chords: [D_MINOR, BB_MAJOR, G_MINOR, A_SUS], beatsPerChord: 4,
    melody: SORROW_THEME, melodyOn: 'choir', chordsOn: ['pad'], level: 0.55,
  },
  dread: {
    bpm: 50, chords: [[-31, -24, -23], [-31, -24, -22]], beatsPerChord: 8,
    melody: null, melodyOn: null, chordsOn: ['drone'], level: 0.6,
  },
  hope: {
    bpm: 70, chords: [G_MAJOR, D_MAJOR, A_MAJOR, D_MAJOR], beatsPerChord: 4,
    melody: MONASTERY_THEME, melodyOn: 'choir', chordsOn: ['pad', 'lyre'], level: 0.5,
  },
};

const LOOKAHEAD = 0.4;
const TICK_MS = 100;
const CROSSFADE = 2.5;
const REVERB_SECONDS = 3.2;
const REVERB_MIX = 0.45;

function hz(semitones: number): number {
  return 440 * Math.pow(2, semitones / 12);
}

let hallBuffer: AudioBuffer | null = null;

/** A long, soft hall: decaying stereo noise used as an impulse response. */
function hall(ctx: AudioContext): AudioBuffer {
  if (hallBuffer && hallBuffer.sampleRate === ctx.sampleRate) return hallBuffer;
  const length = Math.floor(ctx.sampleRate * REVERB_SECONDS);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
  }
  hallBuffer = buffer;
  return buffer;
}

/** A shared output with reverb, for music and anything else that should sound like it is in a hall. */
export function createHall(ctx: AudioContext, out: AudioNode): AudioNode {
  const input = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = hall(ctx);
  const wet = ctx.createGain();
  wet.gain.value = REVERB_MIX;
  input.connect(out);
  input.connect(convolver).connect(wet).connect(out);
  return input;
}

function envelope(ctx: AudioContext, t: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return g;
}

function playPad(ctx: AudioContext, out: AudioNode, freq: number, t: number, length: number, level: number): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.3;
  const env = envelope(ctx, t, 1.4, Math.max(0, length - 1.4), 2.2, level * 0.09);
  filter.connect(env).connect(out);
  for (const detune of [-7, 0, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + length + 2.4);
  }
}

/** A plucked string: a bright attack that mellows as it rings out. */
function playLyre(ctx: AudioContext, out: AudioNode, freq: number, t: number, level: number): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 8, t);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 1.2);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(level * 0.28, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  filter.connect(env).connect(out);
  const partials: readonly (readonly [number, number])[] = [[1, 1], [2, 0.45], [3, 0.2], [4, 0.08]];
  for (const [multiple, gain] of partials) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq * multiple;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(filter);
    osc.start(t);
    osc.stop(t + 2.3);
  }
}

/** A soft "aah" from a few voices, slightly out of tune with each other. */
function playChoir(ctx: AudioContext, out: AudioNode, freq: number, t: number, length: number, level: number): void {
  const env = envelope(ctx, t, 0.6, Math.max(0, length - 0.6), 1.4, level * 0.06);
  env.connect(out);
  const formants: readonly (readonly [number, number])[] = [[800, 1], [1150, 0.5], [2900, 0.12]];
  const filters = formants.map(([f, gain]) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = f;
    filter.Q.value = 5;
    const g = ctx.createGain();
    g.gain.value = gain * 3;
    filter.connect(g).connect(env);
    return filter;
  });
  for (const detune of [-9, 0, 11]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 4.8 + Math.random();
    const depth = ctx.createGain();
    depth.gain.value = freq * 0.006;
    vibrato.connect(depth).connect(osc.frequency);
    for (const f of filters) osc.connect(f);
    for (const o of [osc, vibrato]) {
      o.start(t);
      o.stop(t + length + 1.6);
    }
  }
}

function playDrone(ctx: AudioContext, out: AudioNode, freq: number, t: number, length: number, level: number): void {
  const env = envelope(ctx, t, 2.5, Math.max(0, length - 2.5), 3, level * 0.16);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 260;
  filter.connect(env).connect(out);
  for (const detune of [-4, 3]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + length + 3.2);
  }
}

function playChord(ctx: AudioContext, out: AudioNode, instrument: Instrument, chord: readonly number[], t: number, length: number, beat: number, level: number): void {
  switch (instrument) {
    case 'pad':
      for (const note of chord) playPad(ctx, out, hz(note), t, length, level);
      return;
    case 'choir':
      for (const note of chord.slice(1, 4)) playChoir(ctx, out, hz(note), t, length, level * 0.6);
      return;
    case 'drone':
      for (const note of chord) playDrone(ctx, out, hz(note), t, length, level);
      return;
    case 'lyre':
      // A slow arpeggio up through the chord.
      chord.forEach((note, i) => playLyre(ctx, out, hz(note + 12), t + i * beat * 0.5, level * 0.6));
      return;
  }
}

function playMelodyNote(ctx: AudioContext, out: AudioNode, instrument: Instrument, note: number, t: number, length: number, level: number): void {
  if (instrument === 'lyre') playLyre(ctx, out, hz(note), t, level);
  else if (instrument === 'choir') playChoir(ctx, out, hz(note), t, length, level * 1.4);
  else playPad(ctx, out, hz(note), t, length, level);
}

interface Playing {
  piece: Piece;
  bus: GainNode;
  nextChord: number;
  chordIndex: number;
  nextNote: number;
  noteIndex: number;
}

export class CutsceneMusic {
  private readonly ctx: AudioContext;
  private readonly out: AudioNode;
  private playing: Playing | null = null;
  private cue: MusicCue = 'silence';
  private timer: number | null = null;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = createHall(ctx, out);
  }

  play(cue: MusicCue): void {
    if (cue === this.cue) return;
    this.cue = cue;
    this.fadeOut();
    if (cue === 'silence') return;
    const piece = PIECES[cue];
    const bus = this.ctx.createGain();
    const t = this.ctx.currentTime;
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(piece.level, t + CROSSFADE);
    bus.connect(this.out);
    this.playing = { piece, bus, nextChord: t + 0.1, chordIndex: 0, nextNote: t + 0.1 + (60 / piece.bpm) * 2, noteIndex: 0 };
    this.timer ??= window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  private fadeOut(): void {
    const old = this.playing;
    this.playing = null;
    if (!old) return;
    const t = this.ctx.currentTime;
    old.bus.gain.cancelScheduledValues(t);
    old.bus.gain.setValueAtTime(old.bus.gain.value, t);
    old.bus.gain.linearRampToValueAtTime(0, t + CROSSFADE);
    window.setTimeout(() => old.bus.disconnect(), (CROSSFADE + 4) * 1000);
  }

  private schedule(): void {
    const p = this.playing;
    if (!p) return;
    const now = this.ctx.currentTime;
    // A slowed timer (a hidden tab) leaves the schedule behind: skip what was missed instead of playing it all at once.
    if (p.nextChord < now) p.nextChord = now;
    if (p.nextNote < now) p.nextNote = now;
    const horizon = now + LOOKAHEAD;
    const beat = 60 / p.piece.bpm;
    while (p.nextChord < horizon) {
      const chord = p.piece.chords[p.chordIndex % p.piece.chords.length] ?? [];
      const length = beat * p.piece.beatsPerChord;
      for (const instrument of p.piece.chordsOn) playChord(this.ctx, p.bus, instrument, chord, p.nextChord, length, beat, 1);
      p.nextChord += length;
      p.chordIndex++;
    }
    const melody = p.piece.melody;
    const instrument = p.piece.melodyOn;
    if (!melody || !instrument) return;
    while (p.nextNote < horizon) {
      const [note, beats] = melody[p.noteIndex % melody.length] ?? [null, 1];
      if (note !== null) playMelodyNote(this.ctx, p.bus, instrument, note, p.nextNote, beats * beat, 1);
      p.nextNote += beats * beat;
      p.noteIndex++;
    }
  }

  stop(): void {
    this.cue = 'silence';
    this.fadeOut();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
