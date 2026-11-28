import {
  type ArenaFight,
  afterBattle,
  arenaFight,
  arenaSettings,
  CASSIAN_NAMES,
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
  opensBook,
  nextChapter,
  playerKit,
  reinforceAtFortress,
  workedOut,
  wonArena,
  campaignBattle,
  type CampaignBattle,
  type BattleResult,
} from '@tumblehorde/shared';
import type { World } from '../render/world.ts';
import type { InputState } from '../input/input.ts';
import { CinematicOverlay } from '../cinematic/overlay.ts';
import { CutscenePlayer } from '../cinematic/player.ts';
import type { CinematicSound, Cutscene, StoryContext } from '../cinematic/script.ts';
import { CUTSCENES } from '../cinematic/scenes/index.ts';
import { Stage } from '../cinematic/stage.ts';
import { decorateArena } from './arenaDecor.ts';
import { StoryCard } from './card.ts';
import { SCENES_AFTER, SCENES_BEFORE } from './storyScenes.ts';
import { StoryBattle } from './storyBattle.ts';
import type { LocalSession } from '../game/session.ts';
import { boughtItem, EFFECT, storyDialogue } from './dialogues.ts';
import { CAPITAL, type DistrictSet, festiveCapital, SPY_NAME } from './districts.ts';
import { FreeRoam } from './freeRoam.ts';
import { CampaignPause } from './pause.ts';
import { loadSave, writeSave } from './storage.ts';

/** Seconds the loading card with the chapter's line stays up. */
const LOADING_TIME = 2.6;
/** The card that opens a new book stays a little longer. */
const BOOK_CARD_TIME = 4.5;
/** The chapter that reaches the northern fortress, which fills the legion's ranks. */
const FORTRESS_CHAPTER: ChapterId = 'night-raid';

/** Varro, until he tells Cassian his name. */
const SMITH_UNNAMED = 'Blacksmith';

/** Where each free-roam chapter is walked. */
const CHAPTER_DISTRICTS: Partial<Record<ChapterId, DistrictSet>> = {
  capital: CAPITAL,
  apprentice: CAPITAL,
};


export interface CampaignDeps {
  world: World;
  input: InputState;
  sound: CinematicSound | null;
  canvas: HTMLCanvasElement;
  /** Back to the main menu. */
  onExit: () => void;
  /**
   * Runs a battle in the battle engine; `onEnd` gets the final view once it is over. Story battles
   * pass an objective for the top of the screen and keep the session to check their goals.
   */
  startBattle: (settings: MatchSettings, onEnd: (view: MatchView) => void, objective?: (view: MatchView) => string | null) => LocalSession;
  stopBattle: () => void;
}

/** How a story battle went: won or not, and which legionaries fell. */
export interface StoryBattleOutcome {
  won: boolean;
  fallen: readonly string[];
}

type Phase =
  | { kind: 'idle' }
  /** `until`: the wall-clock time (ms) the card comes down; slow frames must not stretch it. */
  | { kind: 'loading'; chapter: Chapter; until: number }
  | { kind: 'cutscene'; scenes: readonly Cutscene[]; index: number; then: () => void }
  | { kind: 'roam'; chapter: Chapter; roam: FreeRoam }
  | { kind: 'battle'; chapter: Chapter; story?: StoryBattle }
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
  /** One line for the next chapter's card: who fell in the battle just won. */
  private fallenNote: string | null = null;
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
    const arrived = id === FORTRESS_CHAPTER ? { ...this.save, legion: reinforceAtFortress(this.save.legion) } : this.save;
    this.store(checkpoint(arrived, id, Date.now()));
    const chapter = chapterById(id);
    this.overlay.showLoading(chapter, this.fallenNote);
    this.fallenNote = null;
    const seconds = opensBook(chapter.id) ? BOOK_CARD_TIME : LOADING_TIME;
    this.phase = { kind: 'loading', chapter, until: performance.now() + seconds * 1000 };
  }

  private startChapter(chapter: Chapter): void {
    // The card stays up while the chapter is built, so a slow build shows the card, not a frozen frame.
    this.buildChapter(chapter);
    this.overlay.showLoading(null);
  }

  private buildChapter(chapter: Chapter): void {
    const scenes = scenesOf(SCENES_BEFORE[chapter.id]);
    const district = chapter.id === 'golden-city' ? festiveCapital(this.save?.choices.son ?? 'lucius') : CHAPTER_DISTRICTS[chapter.id];
    const fight = arenaFight(chapter.id);
    if (chapter.kind === 'cutscene' && scenes.length > 0) {
      this.playScenes(scenes, () => this.finishChapter(chapter.id));
    } else if (chapter.kind === 'freeRoam' && district) {
      this.startRoam(chapter, district);
    } else if (chapter.kind === 'arena' && fight) {
      this.playScenes(scenes, () => this.startArena(chapter, fight));
    } else if (chapter.kind === 'battle') {
      this.playScenes(scenes, () => this.runStoryBattle(chapter, (outcome) => this.battleDone(chapter, outcome)));
    } else {
      this.showUnbuilt(chapter);
    }
  }

  /** The battle of a battle chapter, fought with the men the story has left (see `campaignBattle`). */
  private runStoryBattle(chapter: Chapter, done: (outcome: StoryBattleOutcome) => void): void {
    const battle = this.save ? campaignBattle(chapter.id, this.save) : null;
    if (!battle) {
      this.showUnbuilt(chapter);
      return;
    }
    const story = new StoryBattle(this.deps.world, this.deps, battle, (result) => {
      story.dispose();
      this.storyBattleOver(chapter, battle, result, done);
    });
    this.phase = { kind: 'battle', chapter, story };
  }

  /** Won (or the last night, which cannot be won): the story goes on. Lost: fight again, or leave. */
  private storyBattleOver(chapter: Chapter, battle: CampaignBattle, result: BattleResult, done: (outcome: StoryBattleOutcome) => void): void {
    if (result.won || battle.onLoss === 'continue') {
      done({ won: result.won, fallen: result.fallenNames });
      return;
    }
    this.phase = { kind: 'card' };
    const text =
      battle.onLoss === 'retryOrLeave' ? 'The horde broke your lines. Rally the legion and fight again, or leave.' : 'Your story is saved at the start of this chapter.';
    this.card.show('Defeated', text, [
      { label: 'Fight again', primary: true, action: () => this.runStoryBattle(chapter, done) },
      { label: 'Leave to menu', action: () => this.leave() },
    ]);
  }

  /** After a won battle: the fallen stay dead (from the Dark Forest on), then the scenes after it. */
  private battleDone(chapter: Chapter, outcome: StoryBattleOutcome): void {
    const save = this.save;
    if (!save) return;
    const { legion, fallen } = afterBattle(save.legion, outcome.fallen, chapter.id);
    this.save = { ...save, legion, fallen: [...fallen] };
    // One short line on the next chapter's card, instead of a scene after every battle.
    this.fallenNote = fallen.length > 0 ? `Fallen: ${fallen.join(', ')}.` : null;
    this.playScenes(scenesOf(SCENES_AFTER[chapter.id]), () => this.finishChapter(chapter.id));
  }

  private showUnbuilt(chapter: Chapter): void {
    this.phase = { kind: 'card' };
    this.card.show(chapter.title, 'This chapter is still being built. Your story is saved here; come back soon.', [
      { label: 'Leave to menu', primary: true, action: () => this.leave() },
    ]);
  }

  /**
   * What scenes see of the story. `save` is read live, so a choice made earlier in the same
   * scene is seen by the beats after it. Choices, like battle outcomes, are kept in memory and
   * written with the next chapter's checkpoint: leaving mid-scene replays the scene cleanly.
   */
  private story(): StoryContext {
    const fallback = newSave(Date.now());
    const get = (): CampaignSave => this.save ?? fallback;
    return {
      get save() {
        return get();
      },
      get fallen() {
        return get().fallen;
      },
      choose: (choices) => {
        if (this.save) this.save = { ...this.save, choices: { ...this.save.choices, ...choices } };
      },
    };
  }

  /** Plays cutscenes one after another, then `then`. */
  private playScenes(scenes: readonly Cutscene[], then: () => void): void {
    const first = scenes[0];
    if (!first) {
      then();
      return;
    }
    this.phase = { kind: 'cutscene', scenes, index: 0, then };
    this.player.play(first, this.story(), () => this.sceneDone());
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
    this.player.play(next, this.story(), () => this.sceneDone());
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
    const look = this.roamLook(chapter);
    const roam = new FreeRoam(new Stage(world), {
      input,
      sound,
      canvas,
      overlay: this.overlay,
      onEffect: (effect) => this.roamEffect(chapter, effect),
      dialogueFor: (id) => (this.save ? storyDialogue(id, this.save, chapter.id) : null),
      spotActive: (id) => id === EFFECT.workout && chapter.id === 'apprentice' && this.save !== null && canWorkOut(this.save),
      status: () => (this.save && chapter.id !== 'golden-city' ? `${this.save.gold} gold · strength ${this.save.strength}` : null),
      renames: chapter.id === 'capital' ? { Varro: SMITH_UNNAMED } : {},
      guide: () => (chapter.id === 'capital' ? SMITH_UNNAMED : chapter.id === 'golden-city' ? SPY_NAME : 'Varro'),
      playerName: chapter.id === 'golden-city' ? (this.save?.choices.son === 'marcus' ? 'Marcus' : 'Lucius') : undefined,
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
      if (!result.ok) return;
      this.store(result.save);
      // He puts it on at once.
      phase.roam.setPlayerLook(this.roamLook(chapter));
      return;
    }
    if (effect === EFFECT.workout) {
      phase.roam.startWorkout((done) => {
        if (done && this.save) this.store(workedOut(this.save));
      });
      return;
    }
    if (effect === EFFECT.acceptJob || effect === EFFECT.nextFight || effect === EFFECT.caughtSpy) {
      this.endRoam();
      this.finishChapter(chapter.id);
    }
  }

  /** Cassian in the city (a cast role): a freed prisoner's rags, the smith's apprentice, then in his silver armor. */
  private roamLook(chapter: Chapter): string {
    if (chapter.id === 'capital') return 'cassianPrisoner';
    if (chapter.id === 'golden-city') return this.save?.choices.son === 'marcus' ? 'marcusMongol' : 'lucius';
    return this.save?.gear.armor ? 'cassianTraveller' : 'cassianSmith';
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
    // In his prisoner's rags with the lent sword and wooden shield, or in the silver armor once bought.
    const look = save.gear.armor ? 'cassianTraveller' : 'cassianPrisoner';
    const settings = arenaSettings(playerKit(save), fight.opponents, arenaSeed(), CASSIAN_NAMES.wanderer, look);
    this.deps.startBattle(settings, (view) => this.arenaOver(chapter, fight, view.winnerTeam === 0), () => 'Last one standing wins');
    decorateArena(this.deps.world);
  }

  private arenaOver(chapter: Chapter, fight: ArenaFight, won: boolean): void {
    const save = this.save;
    if (!save) return;
    this.phase = { kind: 'card' };
    if (won) {
      this.save = wonArena(save, fight);
      // No card: the crowd roars, the purse is thrown down, and Cassian walks out.
      this.playScenes(scenesOf(['arena-victory', ...(SCENES_AFTER[chapter.id] ?? [])]), () => this.finishChapter(chapter.id));
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
    this.card.show('You went down', 'The sand is hot and the crowd is cruel. Get up and try again.', buttons);
  }



  // ---------- frame ----------

  frame(dt: number): void {
    const phase = this.phase;
    const pausable = phase.kind === 'cutscene' || phase.kind === 'roam' || phase.kind === 'loading';
    if (this.pause.consumeToggle() && pausable) this.pause.toggle();
    this.overlay.choiceKeysEnabled = !this.pause.open;
    if (this.pause.open) return;
    if (phase.kind === 'loading') {
      // Space or a click brings the card down at once.
      const skip = this.deps.input.isHeld('Space') || this.deps.input.mouseLeft;
      if (skip || performance.now() >= phase.until) this.startChapter(phase.chapter);
      return;
    }
    if (phase.kind === 'cutscene') this.player.update(dt, this.deps.input.isHeld('Space'));
    if (phase.kind === 'roam') phase.roam.update(dt);
    if (phase.kind === 'battle') phase.story?.update(dt);
  }

  /** Leaves the story; progress stays saved at the last checkpoint. */
  leave(): void {
    this.stop();
    this.deps.onExit();
  }

  stop(): void {
    if (this.phase.kind === 'battle') {
      this.phase.story?.dispose();
      this.deps.stopBattle();
    }
    this.endRoam();
    this.phase = { kind: 'idle' };
    this.player.stop();
    this.pause.hide();
    this.card.hide();
    this.overlay.showLoading(null);
  }
}

/** Each arena fight gets a fresh seed, so no two fights play out alike. */
const ARENA_SEED_MASK = 0xffff;

function arenaSeed(): number {
  return (Date.now() & ARENA_SEED_MASK) | 1;
}
