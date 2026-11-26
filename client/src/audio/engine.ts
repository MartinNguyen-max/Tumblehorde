import { SOUND } from '../visualConfig.ts';

/**
 * Everything audible is made on the fly with Web Audio: no sound files. The engine owns the
 * context and the mix (music and effects), places effects in the world relative to the camera,
 * and keeps a crowd of soldiers from turning into noise by limiting how many play at once.
 */

export interface Voice {
  ctx: AudioContext;
  /** Connect sources here; it already carries volume and stereo position. */
  out: AudioNode;
  /** When to start, in context time. */
  t: number;
}

export interface Place {
  x: number;
  z: number;
}

const STORAGE_KEY = 'tumblehorde.sound';

function readStoredEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function storeEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the choice is simply not remembered.
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listener = { x: 0, z: 0, yaw: 0 };
  private readonly lastPlayed = new Map<string, number>();
  private playing = 0;
  enabled = readStoredEnabled();
  /** Called when sound turns on, so the music can start. */
  onEnable: (() => void) | null = null;

  /** Sound is off by default; turning it on must happen in a click so the browser allows it. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    storeEnabled(on);
    if (on) {
      const ctx = this.context();
      void ctx.resume();
      this.master?.gain.setTargetAtTime(SOUND.master, ctx.currentTime, 0.05);
      this.onEnable?.();
    } else if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  private context(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = SOUND.music;
    this.musicBus.connect(this.master);
    this.effectsBus = ctx.createGain();
    this.effectsBus.gain.value = SOUND.effects;
    this.effectsBus.connect(this.master);
    this.ctx = ctx;
    return ctx;
  }

  /** The music bus, or null while sound has never been turned on. */
  musicOut(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.enabled || !this.ctx || !this.musicBus) return null;
    return { ctx: this.ctx, out: this.musicBus };
  }

  /** White noise, shared by every hiss, whoosh and splash. */
  noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  setListener(x: number, z: number, yaw: number): void {
    this.listener = { x, z, yaw };
  }

  /**
   * A place to play one sound: quieter with distance, panned left or right from the camera.
   * Null when muted, too far, too many sounds are playing, or the same kind of sound played
   * a moment ago (`key`, `gap`) — a hundred clangs at once are just noise.
   */
  voice(at: Place | null, volume: number, key: string, gap: number = SOUND.defaultGap, length: number = SOUND.defaultLength): Voice | null {
    if (!this.enabled || !this.ctx || !this.effectsBus || this.ctx.state !== 'running') return null;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < gap) return null;
    if (this.playing >= SOUND.maxVoices) return null;
    let gainValue = volume;
    let pan = 0;
    if (at) {
      const dx = at.x - this.listener.x;
      const dz = at.z - this.listener.z;
      const distance = Math.hypot(dx, dz);
      if (distance > SOUND.maxDistance) return null;
      gainValue *= 1 / (1 + distance / SOUND.falloff);
      // Right of the camera is positive pan.
      const right = { x: Math.cos(this.listener.yaw), z: -Math.sin(this.listener.yaw) };
      pan = distance > 0.5 ? Math.max(-1, Math.min(1, (dx * right.x + dz * right.z) / distance)) * SOUND.panWidth : 0;
    }
    this.lastPlayed.set(key, now);
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    panner.connect(this.effectsBus);
    this.playing++;
    setTimeout(() => {
      this.playing--;
      gain.disconnect();
      panner.disconnect();
    }, length * 1000);
    return { ctx, out: gain, t: now + SOUND.scheduleAhead };
  }
}
