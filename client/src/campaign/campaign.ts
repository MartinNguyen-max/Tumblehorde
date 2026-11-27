import { type CampaignSave, type Chapter, chapterById, type ChapterId, checkpoint, newSave, nextChapter } from '@tumblehorde/shared';
import type { World } from '../render/world.ts';
import type { InputState } from '../input/input.ts';
import { CinematicOverlay } from '../cinematic/overlay.ts';
import { CutscenePlayer } from '../cinematic/player.ts';
import type { CinematicSound, Cutscene } from '../cinematic/script.ts';
import { CUTSCENES } from '../cinematic/scenes/index.ts';
import { Stage } from '../cinematic/stage.ts';
import type { ActorLook } from '../cinematic/actor.ts';
import { HAIR } from '../cinematic/config.ts';
import { CampaignPause } from './pause.ts';
import { EFFECT } from './dialogues.ts';
import { type DistrictSet, MARKET_SQUARE } from './districts.ts';
import { FreeRoam } from './freeRoam.ts';
import { loadSave, writeSave } from './storage.ts';

/** Seconds the loading card with the chapter's line stays up. */
const LOADING_TIME = 2.6;

/** The cutscenes that make up each cutscene chapter, played in order. */
const CHAPTER_SCENES: Partial<Record<ChapterId, readonly string[]>> = {
  prologue: ['prologue-morning'],
};

/** Where each free-roam chapter is walked. */
const CHAPTER_DISTRICTS: Partial<Record<ChapterId, DistrictSet>> = {
  capital: MARKET_SQUARE,
};

/** Cassian after the years in prison: rags, long hair and a beard. */
const CASSIAN_FREED: ActorLook = { outfit: 'rags', hair: HAIR.brown, hairStyle: 'long', beard: 'long', beardColor: HAIR.brown };

export interface CampaignDeps {
  world: World;
  input: InputState;
  sound: CinematicSound | null;
  canvas: HTMLCanvasElement;
  /** Back to the main menu. */
  onExit: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; chapter: Chapter; timer: number }
  | { kind: 'cutscene'; chapter: Chapter; scenes: readonly Cutscene[]; index: number }
  | { kind: 'roam'; chapter: Chapter; roam: FreeRoam }
  | { kind: 'unbuilt'; chapter: Chapter };

/**
 * The single-player story: walks through the chapters in order, saving at every chapter start,
 * with a short loading card between them. Cutscene chapters play their scenes; the other kinds
 * (free roam, arena, battle) plug in here as they are built.
 */
export class Campaign {
  private readonly deps: CampaignDeps;
  readonly overlay = new CinematicOverlay();
  readonly player: CutscenePlayer;
  private readonly pause: CampaignPause;
  private save: CampaignSave | null = null;
  private phase: Phase = { kind: 'idle' };
  /** Testing a single scene from the debug hook: back to the menu afterwards. */
  private single = false;

  constructor(deps: CampaignDeps) {
    this.deps = deps;
    this.player = new CutscenePlayer(deps.world, this.overlay, deps.sound);
    this.pause = new CampaignPause({ onResume: () => undefined, onLeave: () => this.leave() });
  }

  get active(): boolean {
    return this.phase.kind !== 'idle';
  }

  get current(): CampaignSave | null {
    return this.save;
  }

  /** A fresh story from the prologue. */
  startNew(): void {
    this.begin(newSave(Date.now()));
  }

  /** Picks up at the last checkpoint, or starts anew without one. */
  continueSaved(): void {
    this.begin(loadSave() ?? newSave(Date.now()));
  }

  private begin(save: CampaignSave): void {
    this.pause.consumeToggle();
    this.single = false;
    this.save = save;
    this.enterChapter(save.chapter);
  }

  private enterChapter(id: ChapterId): void {
    if (!this.save) return;
    this.save = checkpoint(this.save, id, Date.now());
    writeSave(this.save);
    const chapter = chapterById(id);
    this.overlay.showLoading(chapter);
    this.phase = { kind: 'loading', chapter, timer: LOADING_TIME };
  }

  private startChapter(chapter: Chapter): void {
    this.overlay.showLoading(null);
    const ids = CHAPTER_SCENES[chapter.id] ?? [];
    const scenes = ids.map((id) => CUTSCENES[id]).filter((s): s is Cutscene => s !== undefined);
    if (chapter.kind === 'cutscene' && scenes.length > 0) {
      this.phase = { kind: 'cutscene', chapter, scenes, index: 0 };
      this.playScene(scenes[0]);
      return;
    }
    const district = CHAPTER_DISTRICTS[chapter.id];
    if (chapter.kind === 'freeRoam' && district) {
      this.startRoam(chapter, district);
      return;
    }
    this.phase = { kind: 'unbuilt', chapter };
    this.pause.showUnbuilt(chapter.title);
  }

  private startRoam(chapter: Chapter, district: DistrictSet): void {
    const { input, sound, canvas, world } = this.deps;
    const deps = { input, sound, canvas, overlay: this.overlay, onEffect: (effect: string) => this.roamEffect(chapter, effect) };
    const roam = new FreeRoam(new Stage(world), deps, district, CASSIAN_FREED);
    this.phase = { kind: 'roam', chapter, roam };
  }

  private roamEffect(chapter: Chapter, effect: string): void {
    if (effect !== EFFECT.acceptJob) return;
    this.endRoam();
    this.finishChapter(chapter.id);
  }

  private endRoam(): void {
    if (this.phase.kind !== 'roam') return;
    this.phase.roam.dispose();
    this.phase.roam.stage.dispose();
    this.overlay.hide();
  }

  /** Jumps straight to a chapter with a fresh save (for testing chapters). */
  startAt(id: ChapterId): void {
    this.begin({ ...newSave(Date.now()), chapter: id });
  }

  private playScene(scene: Cutscene | undefined): void {
    if (!scene) return;
    this.player.play(scene, () => this.sceneDone());
  }

  private sceneDone(): void {
    const phase = this.phase;
    if (this.single) {
      this.leave();
      return;
    }
    if (phase.kind !== 'cutscene') return;
    const next = phase.index + 1;
    if (next < phase.scenes.length) {
      this.phase = { ...phase, index: next };
      this.playScene(phase.scenes[next]);
      return;
    }
    this.finishChapter(phase.chapter.id);
  }

  /** On to the next chapter; after the last one, back to the menu. */
  finishChapter(id: ChapterId, takeOptional = false): void {
    const next = nextChapter(id, takeOptional);
    if (next) this.enterChapter(next);
    else this.leave();
  }

  /** Plays a cutscene by id and returns to the menu after (for testing scenes). */
  playById(id: string): boolean {
    const scene = CUTSCENES[id];
    if (!scene) return false;
    this.single = true;
    this.pause.consumeToggle();
    this.phase = { kind: 'cutscene', chapter: chapterById('prologue'), scenes: [scene], index: 0 };
    this.playScene(scene);
    return true;
  }

  frame(dt: number): void {
    if (this.pause.consumeToggle() && this.phase.kind !== 'unbuilt') this.pause.toggle();
    if (this.pause.open) return;
    const phase = this.phase;
    if (phase.kind === 'loading') {
      phase.timer -= dt;
      if (phase.timer <= 0) this.startChapter(phase.chapter);
      return;
    }
    if (phase.kind === 'cutscene') this.player.update(dt, this.deps.input.isHeld('Space'));
    if (phase.kind === 'roam') phase.roam.update(dt);
  }

  /** Leaves the story; progress stays saved at the last checkpoint. */
  leave(): void {
    this.stop();
    this.deps.onExit();
  }

  stop(): void {
    this.endRoam();
    this.phase = { kind: 'idle' };
    this.single = false;
    this.player.stop();
    this.pause.hide();
    this.overlay.showLoading(null);
  }
}
