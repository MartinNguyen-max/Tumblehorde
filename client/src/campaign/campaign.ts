import {
  type ArenaFight,
  arenaFight,
  arenaSettings,
  buy,
  type CampaignSave,
  canWorkOut,
  type Chapter,
  chapterById,
  type ChapterId,
  checkpoint,
  type MatchSettings,
  type MatchView,
  newSave,
  nextChapter,
  playerKit,
  workedOut,
  wonArena,
} from '@tumblehorde/shared';
import type { World } from '../render/world.ts';
import type { InputState } from '../input/input.ts';
import type { ActorLook } from '../cinematic/actor.ts';
import { CLOTH, HAIR } from '../cinematic/config.ts';
import { CinematicOverlay } from '../cinematic/overlay.ts';
import { CutscenePlayer } from '../cinematic/player.ts';
import type { CinematicSound, Cutscene } from '../cinematic/script.ts';
import { CUTSCENES } from '../cinematic/scenes/index.ts';
import { Stage } from '../cinematic/stage.ts';
import { decorateArena } from './arenaDecor.ts';
import { StoryCard } from './card.ts';
import { boughtItem, EFFECT, storyDialogue } from './dialogues.ts';
import { CAPITAL, type DistrictSet } from './districts.ts';
import { FreeRoam } from './freeRoam.ts';
import { CampaignPause } from './pause.ts';
import { loadSave, writeSave } from './storage.ts';

/** Seconds the loading card with the chapter's line stays up. */
const LOADING_TIME = 2.6;

/** The cutscenes of each chapter, played in order (for arena chapters: before the fight). */
const CHAPTER_SCENES: Partial<Record<ChapterId, readonly string[]>> = {
  prologue: ['prologue-morning'],
  'arena-1': ['arena-tunnel'],
};

/** Cutscenes after an arena fight is won. */
const VICTORY_SCENES: Partial<Record<ChapterId, readonly string[]>> = {
  'arena-1': ['arena-won'],
};

/** Where each free-roam chapter is walked. */
const CHAPTER_DISTRICTS: Partial<Record<ChapterId, DistrictSet>> = {
  capital: CAPITAL,
  apprentice: CAPITAL,
};

/** Cassian after the years in prison: rags, long hair and a beard. */
const CASSIAN_FREED: ActorLook = { outfit: 'rags', hair: HAIR.brown, hairStyle: 'long', beard: 'long', beardColor: HAIR.brown };
/** Varro's apprentice: a clean tunic, hair and beard cut. */
const CASSIAN_APPRENTICE: ActorLook = { outfit: 'smith', color: CLOTH.tunic, hair: HAIR.brown, hairStyle: 'short', beard: 'short', beardColor: HAIR.brown };

export interface CampaignDeps {
  world: World;
  input: InputState;
  sound: CinematicSound | null;
  canvas: HTMLCanvasElement;
  /** Back to the main menu. */
  onExit: () => void;
  /** Runs a battle in the battle engine; `onEnd` gets the final view once it is over. */
  startBattle: (settings: MatchSettings, onEnd: (view: MatchView) => void) => void;
  stopBattle: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; chapter: Chapter; timer: number }
  | { kind: 'cutscene'; scenes: readonly Cutscene[]; index: number; then: () => void }
  | { kind: 'roam'; chapter: Chapter; roam: FreeRoam }
  | { kind: 'battle'; chapter: Chapter }
  | { kind: 'card' };

function scenesOf(ids: readonly string[] | undefined): Cutscene[] {
  return (ids ?? []).map((id) => CUTSCENES[id]).filter((s): s is Cutscene => s !== undefined);
}

/**
 * The single-player story: walks through the chapters in order, saving at every chapter start,
 * with a short loading card between them. Cutscene chapters play their scenes, free-roam chapters
 * walk a district, arena chapters fight in the battle engine.
 */
export class Campaign {
  private readonly deps: CampaignDeps;
  readonly overlay = new CinematicOverlay();
  readonly player: CutscenePlayer;
  private readonly pause: CampaignPause;
  private readonly card = new StoryCard();
  private save: CampaignSave | null = null;
  private phase: Phase = { kind: 'idle' };

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

  /** Jumps straight to a chapter with a fresh save (for testing chapters). */
  startAt(id: ChapterId, changes: Partial<CampaignSave> = {}): void {
    this.begin({ ...newSave(Date.now()), ...changes, chapter: id });
  }

  private begin(save: CampaignSave): void {
    this.pause.consumeToggle();
    this.save = save;
    this.enterChapter(save.chapter);
  }

  private store(save: CampaignSave): void {
    this.save = save;
    writeSave(save);
  }

  private enterChapter(id: ChapterId): void {
    if (!this.save) return;
    this.store(checkpoint(this.save, id, Date.now()));
    const chapter = chapterById(id);
    this.overlay.showLoading(chapter);
    this.phase = { kind: 'loading', chapter, timer: LOADING_TIME };
  }

  private startChapter(chapter: Chapter): void {
    this.overlay.showLoading(null);
    const scenes = scenesOf(CHAPTER_SCENES[chapter.id]);
    const district = CHAPTER_DISTRICTS[chapter.id];
    const fight = arenaFight(chapter.id);
    if (chapter.kind === 'cutscene' && scenes.length > 0) {
      this.playScenes(scenes, () => this.finishChapter(chapter.id));
    } else if (chapter.kind === 'freeRoam' && district) {
      this.startRoam(chapter, district);
    } else if (chapter.kind === 'arena' && fight) {
      this.playScenes(scenes, () => this.startArena(chapter, fight));
    } else {
      this.showUnbuilt(chapter);
    }
  }

  private showUnbuilt(chapter: Chapter): void {
    this.phase = { kind: 'card' };
    this.card.show(chapter.title, 'This chapter is still being built. Your story is saved here; come back soon.', [
      { label: 'Leave to menu', primary: true, action: () => this.leave() },
    ]);
  }

  /** Plays cutscenes one after another, then `then`. */
  private playScenes(scenes: readonly Cutscene[], then: () => void): void {
    const first = scenes[0];
    if (!first) {
      then();
      return;
    }
    this.phase = { kind: 'cutscene', scenes, index: 0, then };
    this.player.play(first, () => this.sceneDone());
  }

  private sceneDone(): void {
    const phase = this.phase;
    if (phase.kind !== 'cutscene') return;
    const next = phase.scenes[phase.index + 1];
    if (!next) {
      phase.then();
      return;
    }
    this.phase = { ...phase, index: phase.index + 1 };
    this.player.play(next, () => this.sceneDone());
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
    this.pause.consumeToggle();
    this.playScenes([scene], () => this.leave());
    return true;
  }

  // ---------- free roam ----------

  private startRoam(chapter: Chapter, district: DistrictSet): void {
    const { input, sound, canvas, world } = this.deps;
    const look = chapter.id === 'capital' ? CASSIAN_FREED : CASSIAN_APPRENTICE;
    const roam = new FreeRoam(new Stage(world), {
      input,
      sound,
      canvas,
      overlay: this.overlay,
      onEffect: (effect) => this.roamEffect(chapter, effect),
      dialogueFor: (id) => (this.save ? storyDialogue(id, this.save, chapter.id) : null),
      spotActive: (id) => id === EFFECT.workout && chapter.id === 'apprentice' && this.save !== null && canWorkOut(this.save),
      status: () => (this.save ? `${this.save.gold} gold · strength ${this.save.strength}` : null),
    }, district, look);
    this.phase = { kind: 'roam', chapter, roam };
  }

  private roamEffect(chapter: Chapter, effect: string): void {
    const save = this.save;
    const phase = this.phase;
    if (!save || phase.kind !== 'roam') return;
    const item = boughtItem(effect);
    if (item) {
      const result = buy(save, item);
      if (result.ok) this.store(result.save);
      return;
    }
    if (effect === EFFECT.workout) {
      phase.roam.startWorkout((done) => {
        if (done && this.save) this.store(workedOut(this.save));
      });
      return;
    }
    if (effect === EFFECT.acceptJob || effect === EFFECT.nextFight) {
      this.endRoam();
      this.finishChapter(chapter.id);
    }
  }

  private endRoam(): void {
    if (this.phase.kind !== 'roam') return;
    this.phase.roam.dispose();
    this.phase.roam.stage.dispose();
    this.overlay.hide();
    this.phase = { kind: 'idle' };
  }

  // ---------- arena ----------

  private startArena(chapter: Chapter, fight: ArenaFight): void {
    const save = this.save;
    if (!save) return;
    this.phase = { kind: 'battle', chapter };
    this.overlay.hide();
    const settings = arenaSettings(playerKit(save), fight.opponents, (Date.now() & 0xffff) | 1);
    this.deps.startBattle(settings, (view) => this.arenaOver(chapter, fight, view.winnerTeam === 0));
    decorateArena(this.deps.world);
  }

  private arenaOver(chapter: Chapter, fight: ArenaFight, won: boolean): void {
    const save = this.save;
    if (!save) return;
    this.phase = { kind: 'card' };
    if (won) {
      this.store(wonArena(save, fight));
      const prize = fight.givesDracoSword ? `${fight.reward} gold and Draco's sword` : `${fight.reward} gold`;
      this.card.show('Victory!', `The crowd roars your name. You win ${prize}.`, [
        { label: 'Go on', primary: true, action: () => this.playScenes(scenesOf(VICTORY_SCENES[chapter.id]), () => this.afterArenaWin(chapter)) },
      ]);
      return;
    }
    if (chapter.id === 'arena-1') {
      this.card.show('You went down', 'Varro drags you out of the sand. "Not today, then. Come and find me when you can stand."', [
        { label: 'Back to the city', primary: true, action: () => this.enterChapter('capital') },
      ]);
      return;
    }
    const buttons = [
      { label: 'Fight again', primary: true, action: () => this.startArena(chapter, fight) },
      { label: 'Leave to menu', action: () => this.leave() },
    ];
    if (chapter.optional) buttons.splice(1, 0, { label: 'Let Draco keep his crown', primary: false, action: () => this.finishChapter(chapter.id) });
    this.card.show('You went down', 'The sand is hot and the crowd is cruel. Get up and try again.', buttons);
  }

  private afterArenaWin(chapter: Chapter): void {
    if (chapter.id !== 'arena-2') {
      this.finishChapter(chapter.id);
      return;
    }
    this.phase = { kind: 'card' };
    this.card.show('A challenge', 'Draco the Undefeated, the crowd\'s favourite, has heard of you. He wants to fight. It is your choice.', [
      { label: 'Fight Draco', primary: true, action: () => this.finishChapter(chapter.id, true) },
      { label: 'Not now', action: () => this.finishChapter(chapter.id) },
    ]);
  }

  // ---------- frame ----------

  frame(dt: number): void {
    const phase = this.phase;
    const pausable = phase.kind === 'cutscene' || phase.kind === 'roam' || phase.kind === 'loading';
    if (this.pause.consumeToggle() && pausable) this.pause.toggle();
    if (this.pause.open) return;
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
    if (this.phase.kind === 'battle') this.deps.stopBattle();
    this.endRoam();
    this.phase = { kind: 'idle' };
    this.player.stop();
    this.pause.hide();
    this.card.hide();
    this.overlay.showLoading(null);
  }
}
