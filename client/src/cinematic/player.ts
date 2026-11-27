import {
  type BeatTiming,
  createTimeline,
  isTimelineDone,
  lineDuration,
  resumeTimeline,
  skipProgress,
  startTimeline,
  stepTimeline,
  type Timeline,
  type TimelineStep,
} from '@tumblehorde/shared';
import type { World } from '../render/world.ts';
import type { CinematicOverlay } from './overlay.ts';
import type { Beat, CinematicSound, Cutscene, StoryContext } from './script.ts';
import { frameShot, type Shot, unblock } from './shot.ts';
import { Stage } from './stage.ts';

const PAUSE_BEAT = 2.5;
/** A speaker's mouth stops moving a little before their line leaves the screen. */
const TALK_SHARE = 0.8;
/** The skip hint shows for the first seconds of a scene, and whenever Space is held. */
const SKIP_HINT_TIME = 4;

function beatDuration(beat: Beat): number {
  if (beat.duration !== undefined) return beat.duration;
  const text = beat.say?.text ?? beat.narrate ?? beat.letter;
  return text ? lineDuration(text) * (beat.letter ? 2 : 1) : PAUSE_BEAT;
}

function setTalking(stage: Stage, who: string, on: boolean): void {
  const actor = stage.actors.get(who);
  if (actor) actor.talking = on;
}

/** Plays one cutscene at a time on its own stage. */
export class CutscenePlayer {
  private readonly world: World;
  private readonly overlay: CinematicOverlay;
  private readonly sound: CinematicSound | null;
  private stage: Stage | null = null;
  private beats: Beat[] = [];
  private timings: BeatTiming[] = [];
  private timeline: Timeline = createTimeline();
  private shot: Shot | null = null;
  private onDone: (() => void) | null = null;
  /** Beats of a branch not taken, which end at once. */
  private readonly unseen = new Set<number>();
  private time = 0;

  constructor(world: World, overlay: CinematicOverlay, sound: CinematicSound | null) {
    this.world = world;
    this.overlay = overlay;
    this.sound = sound;
  }

  get active(): boolean {
    return this.stage !== null;
  }

  /** The stage of the running scene, for debugging and screenshots. */
  get currentStage(): Stage | null {
    return this.stage;
  }

  play(scene: Cutscene, story: StoryContext, onDone: () => void): void {
    this.stop();
    const stage = new Stage(this.world);
    this.stage = stage;
    this.beats = scene.create(stage, story);
    this.timings = this.beats.map((beat) => ({ duration: beatDuration(beat), waits: beat.choice !== undefined }));
    this.timeline = createTimeline();
    this.unseen.clear();
    this.shot = null;
    this.time = 0;
    this.onDone = onDone;
    this.overlay.show(true);
    this.overlay.fade(0, 'black', 0);
    this.apply(startTimeline(this.timeline, this.timings));
  }

  /** Ends the scene without calling back (leaving the campaign). */
  stop(): void {
    if (!this.stage) return;
    this.sound?.stop();
    this.stage.dispose();
    this.stage = null;
    this.overlay.hide();
  }

  update(dt: number, skipHeld: boolean): void {
    const stage = this.stage;
    if (!stage) return;
    this.time += dt;
    this.apply(stepTimeline(this.timeline, this.timings, dt, skipHeld));
    if (!this.stage) return;
    if (isTimelineDone(this.timeline, this.timings)) {
      const done = this.onDone;
      this.stop();
      done?.();
      return;
    }
    const beat = this.beats[this.timeline.beat];
    const duration = this.timings[this.timeline.beat]?.duration ?? 1;
    const progress = duration > 0 ? Math.min(1, this.timeline.elapsed / duration) : 1;
    if (beat && !this.unseen.has(this.timeline.beat)) {
      beat.during?.(stage, progress);
      if (beat.say) setTalking(stage, beat.say.who, progress < TALK_SHARE);
    }
    if (this.shot) stage.focus.copyFrom(frameShot(stage.camera, this.shot, progress, this.time));
    stage.update(dt);
    this.sound?.refresh();
    this.overlay.setSkip(skipProgress(this.timeline), skipHeld || this.time < SKIP_HINT_TIME);
  }

  private apply(step: TimelineStep): void {
    const stage = this.stage;
    if (!stage) return;
    for (const { beat: index, skipped } of step.ended) {
      const beat = this.beats[index];
      if (!beat) continue;
      if (skipped && !this.unseen.has(index)) {
        beat.during?.(stage, 1);
        stage.finishMoves();
      }
      if (beat.say) setTalking(stage, beat.say.who, false);
    }
    for (const index of step.started) {
      const beat = this.beats[index];
      if (beat) this.startBeat(stage, beat, index);
    }
  }

  private startBeat(stage: Stage, beat: Beat, index: number): void {
    const timing = this.timings[index];
    if (beat.when && !beat.when() && timing) {
      // A beat of the branch not taken: it ends at once, unseen.
      timing.duration = 0;
      timing.waits = false;
      this.unseen.add(index);
      return;
    }
    if (beat.fade) this.overlay.fade(beat.fade.to, beat.fade.color, beat.fade.time, beat.fade.from);
    if (beat.music) this.sound?.music(beat.music);
    if (beat.sound) this.sound?.effect(beat.sound);
    beat.run?.(stage);
    if (beat.shot) this.shot = unblock(typeof beat.shot === 'function' ? beat.shot() : beat.shot, stage.actors.values());
    this.overlay.setTitle(beat.title ?? null);
    this.overlay.setLetter(beat.letter ?? null);
    if (beat.say) {
      const actor = stage.actors.get(beat.say.who);
      const mood = beat.say.mood ?? 'neutral';
      if (actor) {
        actor.setMood(mood);
        this.sound?.speak(actor.voice, mood, beatDuration(beat) * TALK_SHARE);
      }
      this.overlay.say(beat.say.as ?? beat.say.who, beat.say.text);
    } else if (beat.narrate) {
      this.overlay.say(null, beat.narrate);
    } else {
      this.overlay.say(null, null);
    }
    if (beat.choice) {
      const { options, pick } = beat.choice;
      this.overlay.offerChoices(options, (index) => {
        pick(index);
        resumeTimeline(this.timeline);
      });
    }
  }
}
