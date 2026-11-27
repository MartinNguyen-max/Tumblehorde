import type { Mood } from '@tumblehorde/shared';
import type { CinematicSound, MusicCue, SoundCue, VoiceSpec } from '../cinematic/script.ts';
import { type Babble, babble, type Contour } from './babble.ts';
import type { AudioEngine, Voice } from './engine.ts';
import { createHall, CutsceneMusic } from './music.ts';

/**
 * The sound of cutscenes: music, emotional gibberish voices (sad, crying, warm, angry...) and a
 * few effects (the monastery bell, thunder, fire). Nothing plays while the sound is off.
 */

interface MoodVoice {
  pitch: number;
  rate: number;
  contour: Contour;
  loudness: number;
  vibrato: number;
  holdLast: number;
  /** Seconds of silence between phrases: sobs and sighs. */
  gap: number;
  syllables: number;
}

const MOOD_VOICE: Record<Mood, MoodVoice> = {
  neutral: { pitch: 1, rate: 1, contour: 'flat', loudness: 0.32, vibrato: 0.01, holdLast: 1.3, gap: 0.25, syllables: 5 },
  happy: { pitch: 1.15, rate: 0.9, contour: 'rise', loudness: 0.36, vibrato: 0.02, holdLast: 1.6, gap: 0.2, syllables: 5 },
  warm: { pitch: 0.95, rate: 1.2, contour: 'flat', loudness: 0.26, vibrato: 0.015, holdLast: 1.8, gap: 0.35, syllables: 4 },
  sad: { pitch: 0.88, rate: 1.45, contour: 'fall', loudness: 0.22, vibrato: 0.03, holdLast: 2.2, gap: 0.6, syllables: 3 },
  crying: { pitch: 1.2, rate: 1.3, contour: 'wobble', loudness: 0.28, vibrato: 0.08, holdLast: 3, gap: 0.45, syllables: 2 },
  angry: { pitch: 0.85, rate: 0.85, contour: 'fall', loudness: 0.48, vibrato: 0.02, holdLast: 1.2, gap: 0.15, syllables: 4 },
  afraid: { pitch: 1.3, rate: 0.75, contour: 'rise', loudness: 0.34, vibrato: 0.06, holdLast: 1.4, gap: 0.12, syllables: 4 },
  surprised: { pitch: 1.25, rate: 1, contour: 'rise', loudness: 0.38, vibrato: 0.02, holdLast: 2, gap: 0.3, syllables: 2 },
  shout: { pitch: 1.05, rate: 0.9, contour: 'rise', loudness: 0.6, vibrato: 0.04, holdLast: 3, gap: 0.2, syllables: 3 },
};

const VOICE_LEVEL = 0.9;
const EFFECT_LEVEL = 0.7;
const MAX_PHRASES = 6;

export class CinematicAudio implements CinematicSound {
  private readonly engine: AudioEngine;
  private music_: CutsceneMusic | null = null;
  private voiceOut: AudioNode | null = null;
  private wanted: MusicCue = 'silence';

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  /** Builds the music and voice outputs once the sound is on. */
  private outputs(): { ctx: AudioContext; music: CutsceneMusic; voices: AudioNode } | null {
    const direct = this.engine.directOut();
    if (!direct) return null;
    if (!this.music_ || !this.voiceOut) {
      this.music_ = new CutsceneMusic(direct.ctx, direct.out);
      const level = direct.ctx.createGain();
      level.gain.value = VOICE_LEVEL;
      level.connect(createHall(direct.ctx, direct.out));
      this.voiceOut = level;
    }
    return { ctx: direct.ctx, music: this.music_, voices: this.voiceOut };
  }

  music(cue: MusicCue): void {
    this.wanted = cue;
    this.outputs()?.music.play(cue);
  }

  /** Catches up on music when the player turns the sound on in the middle of a scene. */
  refresh(): void {
    if (this.wanted !== 'silence') this.outputs()?.music.play(this.wanted);
  }

  speak(voice: VoiceSpec, mood: Mood, seconds: number): void {
    const out = this.outputs();
    if (!out) return;
    const style = MOOD_VOICE[mood];
    let t = out.ctx.currentTime + 0.05;
    const end = t + seconds;
    for (let i = 0; i < MAX_PHRASES && t < end - 0.3; i++) {
      const phrase: Babble = {
        syllables: Math.max(1, Math.round(style.syllables * (0.7 + Math.random() * 0.6))),
        pitch: voice.pitch * style.pitch,
        rate: voice.rate * style.rate,
        contour: style.contour,
        loudness: style.loudness,
        vibrato: style.vibrato,
        holdLast: style.holdLast,
      };
      const v: Voice = { ctx: out.ctx, out: out.voices, t };
      t += babble(this.engine, v, phrase) + style.gap;
    }
  }

  effect(cue: SoundCue): void {
    const out = this.outputs();
    if (!out) return;
    const level = out.ctx.createGain();
    level.gain.value = EFFECT_LEVEL;
    level.connect(out.voices);
    EFFECTS[cue](this.engine, out.ctx, level, out.ctx.currentTime + 0.03);
  }

  stop(): void {
    this.wanted = 'silence';
    this.music_?.stop();
  }
}

type Effect = (engine: AudioEngine, ctx: AudioContext, out: AudioNode, t: number) => void;

function noise(engine: AudioEngine, ctx: AudioContext, t: number, length: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = engine.noiseBuffer(ctx);
  src.loop = true;
  src.start(t);
  src.stop(t + length);
  return src;
}

function tone(ctx: AudioContext, out: AudioNode, freq: number, t: number, length: number, peak: number, type: OscillatorType = 'sine'): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

function filteredNoise(engine: AudioEngine, ctx: AudioContext, out: AudioNode, t: number, length: number, type: BiquadFilterType, freq: number, peak: number, attack: number): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  noise(engine, ctx, t, length).connect(filter).connect(g).connect(out);
  return filter;
}

const EFFECTS: Record<SoundCue, Effect> = {
  /** A big bronze bell: inharmonic partials ringing for a long time. */
  bell: (_e, ctx, out, t) => {
    const base = 196;
    const partials: readonly (readonly [number, number, number])[] = [[0.5, 0.25, 7], [1, 0.3, 6], [1.19, 0.15, 4], [1.5, 0.12, 3.5], [2, 0.1, 3], [2.74, 0.06, 2]];
    for (const [ratio, gain, length] of partials) tone(ctx, out, base * ratio, t, length, gain);
  },
  thunder: (e, ctx, out, t) => {
    const f = filteredNoise(e, ctx, out, t, 4, 'lowpass', 140, 0.9, 0.08);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 3);
  },
  fire: (e, ctx, out, t) => {
    filteredNoise(e, ctx, out, t, 4, 'lowpass', 500, 0.25, 0.5);
    for (let i = 0; i < 24; i++) filteredNoise(e, ctx, out, t + Math.random() * 3.5, 0.04, 'highpass', 2500, 0.35, 0.002);
  },
  door: (e, ctx, out, t) => {
    const creak = ctx.createOscillator();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(90, t);
    creak.frequency.linearRampToValueAtTime(140, t + 0.9);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    creak.connect(f).connect(g).connect(out);
    creak.start(t);
    creak.stop(t + 1.05);
    tone(ctx, out, 70, t + 1, 0.4, 0.6);
    filteredNoise(e, ctx, out, t + 1, 0.3, 'lowpass', 300, 0.5, 0.005);
  },
  crowd: (e, ctx, out, t) => {
    const f = filteredNoise(e, ctx, out, t, 5, 'bandpass', 700, 0.5, 1.2);
    f.Q.value = 0.6;
  },
  horn: (_e, ctx, out, t) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(116, t + 2.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(1100, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.5);
    g.gain.setValueAtTime(0.4, t + 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    osc.connect(f).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 3.1);
  },
  chisel: (e, ctx, out, t) => {
    for (let i = 0; i < 6; i++) filteredNoise(e, ctx, out, t + i * 0.42 + Math.random() * 0.1, 0.05, 'bandpass', 3200, 0.4, 0.002);
  },
  heartbeat: (_e, ctx, out, t) => {
    for (let i = 0; i < 4; i++) {
      tone(ctx, out, 55, t + i * 0.9, 0.18, 0.7);
      tone(ctx, out, 50, t + i * 0.9 + 0.22, 0.2, 0.5);
    }
  },
  wind: (e, ctx, out, t) => {
    const f = filteredNoise(e, ctx, out, t, 6, 'bandpass', 500, 0.3, 2);
    f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(900, t + 3);
    f.frequency.linearRampToValueAtTime(450, t + 6);
  },
};
