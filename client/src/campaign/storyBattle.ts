import {
  battleResult,
  type BattleResult,
  type CampaignBattle,
  checkStoryGoal,
  holdTimeLeft,
  type MatchSettings,
  type MatchView,
} from '@tumblehorde/shared';
import type { LocalSession } from '../game/session.ts';
import type { World } from '../render/world.ts';
import { BattleSet } from './battleSet.ts';
import { TutorialHint } from './tutorialHint.ts';

/** The campaign's battle host (main.ts): runs a battle on the battle screen and calls back once it is over. */
export interface StoryBattleHost {
  startBattle: (settings: MatchSettings, onEnd: (view: MatchView) => void, objective?: (view: MatchView) => string | null) => LocalSession;
}

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
  private readonly set: BattleSet;
  private readonly session: LocalSession;
  private readonly hint: TutorialHint;
  private ended = false;
  /** The result at the moment a goal decided the battle: nobody who falls after the clock ran out counts. */
  private decided: BattleResult | null = null;

  constructor(world: World, host: StoryBattleHost, battle: CampaignBattle, onEnd: (result: BattleResult) => void) {
    this.battle = battle;
    this.session = host.startBattle(
      battle.settings,
      () => {
        if (this.ended) return;
        this.ended = true;
        onEnd(this.decided ?? battleResult(battle, this.session.match));
      },
      (view) => this.objective(view),
    );
    this.set = new BattleSet(world, battle.settings.map, battle.time, {
      burning: battle.chapter === 'burning-village',
      torches: TORCHES[battle.chapter] ?? [],
    });
    this.hint = new TutorialHint(battle.tutorial);
  }

  private objective(view: MatchView): string {
    const left = holdTimeLeft(this.battle, view.time);
    if (left !== null && this.battle.goal.kind === 'hold') return `${this.battle.objective} · ${this.battle.goal.label} ${clock(left)}`;
    return this.battle.objective;
  }

  /** Called every frame; the battle itself is run by the battle screen. */
  update(dt: number): void {
    this.set.update(dt);
    if (!this.ended) this.hint.update(dt, this.session.match);
    this.checkGoal();
  }

  /** The goal itself is the simulation's (`checkStoryGoal`); here its result is kept as it was then. */
  private checkGoal(): void {
    const state = this.session.match;
    const outcome = checkStoryGoal(state, this.battle);
    if (outcome === null) return;
    const result = battleResult(this.battle, state);
    this.decided = { ...result, won: outcome === 'won' };
  }

  /** Takes down the light, fire and torches; the battle screen is closed by the host. */
  dispose(): void {
    this.set.dispose();
    this.hint.dispose();
  }
}
