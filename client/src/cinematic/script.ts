import type { CampaignChoices, CampaignSave, Mood } from '@tumblehorde/shared';
import type { FadeColor } from './overlay.ts';
import type { Shot } from './shot.ts';
import type { Stage } from './stage.ts';

/**
 * How cutscenes are written: a scene builds its set and cast on the stage and returns its beats.
 * A beat is one shot or one line. Everything a beat starts must be able to jump to its end
 * (`during` at progress 1), because holding Space can skip any beat.
 */

/** What the music does from a beat on; the soundtrack only plays in cutscenes. */
export type MusicCue = 'monastery' | 'warm' | 'sorrow' | 'dread' | 'hope' | 'silence';

/** How someone sounds: their gibberish voice. */
export interface VoiceSpec {
  pitch: number;
  /** Seconds per syllable. */
  rate: number;
}

export type SoundCue = 'bell' | 'thunder' | 'fire' | 'door' | 'crowd' | 'horn' | 'chisel' | 'heartbeat' | 'wind';

export interface Beat {
  /** Seconds; defaults to the time needed to read the line, or a short pause. */
  duration?: number;
  /** A shot, or a function that plans it when the beat starts (after `run`), from where actors are then. */
  shot?: Shot | (() => Shot);
  /** An actor (by stage name) speaks. `as` is the name shown, if not the actor's. */
  say?: { who: string; text: string; mood?: Mood; as?: string };
  /** Old Cassian, telling the story. */
  narrate?: string;
  title?: { text: string; sub?: string };
  /** A letter on parchment, read in silence. */
  letter?: string;
  /** Fade to `to` (0 clear, 1 covered) over `time` seconds, from `from` if given. */
  fade?: { to: number; from?: number; color?: FadeColor; time?: number };
  music?: MusicCue;
  sound?: SoundCue;
  /** At the start of the beat. */
  run?: (stage: Stage) => void;
  /** Every frame of the beat, with progress 0..1; called with 1 when the beat is skipped. */
  during?: (stage: Stage, progress: number) => void;
  /** Only played when this is true at the start of the beat (a branch after a choice). */
  when?: () => boolean;
  /** Stops and waits for the player to pick; `pick` gets the chosen index. */
  choice?: { options: readonly string[]; pick: (index: number) => void };
}

export interface Cutscene {
  id: string;
  /** Builds the set and the cast, and returns the beats. */
  create(stage: Stage, story: StoryContext): Beat[];
}

/** The sound side of a cutscene, so the player does not depend on Web Audio directly. */
export interface CinematicSound {
  music(cue: MusicCue): void;
  speak(voice: VoiceSpec, mood: Mood, seconds: number): void;
  effect(cue: SoundCue): void;
  /** Called every frame: starts the music if the sound was just turned on. */
  refresh(): void;
  stop(): void;
}

/** What a scene knows about the story so far, and how its choices change it. */
export interface StoryContext {
  save: CampaignSave;
  /** Legionaries who fell in the battle just fought, for the roll call. */
  fallen: readonly string[];
  /** Records a choice (Eirik, Hrolf, the last stand); saved with the story. */
  choose(choices: Partial<CampaignChoices>): void;
}

/** A story for testing scenes on their own: a fresh save, choices are not kept. */
export function testStory(save: CampaignSave): StoryContext {
  return { save, fallen: [], choose: (c) => Object.assign(save.choices, c) };
}
