import {
  battleResult,
  type BattleResult,
  type CampaignBattle,
  declareVictory,
  holdTimeLeft,
  type MatchSettings,
  type MatchView,
  STORY_BATTLE,
} from '@tumblehorde/shared';
import type { LocalSession } from '../game/session.ts';
import type { World } from '../render/world.ts';
import { BattleSet } from './battleSet.ts';

/** What main.ts lends the campaign to show a battle: the usual battle screen, without the results dialog. */
export interface BattleScreen {
  open(settings: MatchSettings, objective: (view: MatchView) => string | null, onFinished: (view: MatchView) => void): LocalSession;
  frame(dt: number, now: number): void;
  close(): void;
}

/** Seconds the dead keep coming after Cassian falls, before the story moves on. */
const LAST_STAND_AFTERMATH = 3;

/** Torches round the night camp, and along the column in the dark forest. */
const TORCHES: Partial<Record<CampaignBattle['chapter'], readonly { x: number; z: number }[]>> = {
  'night-raid': [
    { x: -38, z: -30 }, { x: -22, z: -30 }, { x: -30, z: -38 }, { x: -30, z: -22 }, { x: -36, z: -24 }, { x: -24, z: -36 },
  ],
  'dark-forest': [{ x: 10, z: 4.5 }, { x: 18, z: -4.5 }, { x: 26, z: 4.5 }],
  'last-night': [{ x: 40, z: 6 }, { x: 40, z: -6 }, { x: 52, z: 10 }, { x: 52, z: -10 }],
};

function clock(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * One story battle on screen: the battle set (light, fire, torches), the objective line, the hold
 * clock, the end of the last stand, and the result for the story once the winners have celebrated.
 */
export class StoryBattle {
  private readonly battle: CampaignBattle;
  private readonly screen: BattleScreen;
  private readonly set: BattleSet;
  private readonly session: LocalSession;
  private ended = false;

  constructor(world: World, screen: BattleScreen, battle: CampaignBattle, onEnd: (result: BattleResult) => void) {
    this.battle = battle;
    this.screen = screen;
    this.session = screen.open(battle.settings, (view) => this.objective(view), () => {
      if (this.ended) return;
      this.ended = true;
      onEnd(battleResult(battle, this.session.match));
    });
    this.set = new BattleSet(world, battle.settings.map, battle.time, {
      burning: battle.chapter === 'burning-village',
      torches: TORCHES[battle.chapter] ?? [],
    });
  }

  private objective(view: MatchView): string {
    const left = holdTimeLeft(this.battle, view.time);
    if (left !== null && this.battle.goal.kind === 'hold') return `${this.battle.objective} · ${this.battle.goal.label} ${clock(left)}`;
    return this.battle.objective;
  }

  frame(dt: number, now: number): void {
    this.set.update(dt);
    this.checkGoal();
    this.screen.frame(dt, now);
  }

  /** Holding out wins; on the last night, Cassian's fall (or time) ends it. */
  private checkGoal(): void {
    const state = this.session.match;
    if (state.phase !== 'playing') return;
    const mine = state.armies[0];
    if (!mine) return;
    if (holdTimeLeft(this.battle, state.time) === 0 && !mine.eliminated) declareVictory(state, mine.team);
    if (this.battle.goal.kind !== 'lastStand') return;
    if (mine.stats.commanderDeaths > 0 || state.time > STORY_BATTLE.lastStandMax) {
      const enemy = state.armies.find((a) => a.team !== mine.team);
      declareVictory(state, enemy?.team ?? mine.team);
      state.endTimer = LAST_STAND_AFTERMATH;
    }
  }

  dispose(): void {
    this.set.dispose();
    this.screen.close();
  }
}
