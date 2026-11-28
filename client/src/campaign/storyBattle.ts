import {
  battleResult,
  type BattleResult,
  type CampaignBattle,
  checkStoryGoal,
  DUEL_POINTS,
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

/** The ring of legionaries round the duel with Hrolf. */
const DUEL_RING = { x: DUEL_POINTS.center.x, z: DUEL_POINTS.center.z, radius: 11 } as const;

const SEWER_TORCHES: readonly { x: number; z: number }[] = [-12, -6, 0, 6, 12].flatMap((z, row) =>
  [-36, -20, -4, 12, 28].map((x) => ({ x: x + (row % 2) * 8, z: z + (z > 0 ? -1.6 : 1.6) })),
);

/** Places on fire when the battle is fought: the raided village, and the street up to Livia in the taken capital. */
const BURNING: Partial<Record<CampaignBattle['chapter'], true | { x: number; z: number; radius: number }>> = {
  'burning-village': true,
  'the-gate': { x: 36, z: -46, radius: 28 },
};

/** Torches round the night camp, along the column in the dark forest, and up the street to Livia. */
const TORCHES: Partial<Record<CampaignBattle['chapter'], readonly { x: number; z: number }[]>> = {
  'night-raid': [
    { x: -38, z: -30 }, { x: -22, z: -30 }, { x: -30, z: -38 }, { x: -30, z: -22 }, { x: -36, z: -24 }, { x: -24, z: -36 },
  ],
  'dark-forest': [{ x: 10, z: 4.5 }, { x: 18, z: -4.5 }, { x: 26, z: 4.5 }],
  'the-gate': [{ x: 33, z: -58 }, { x: 39, z: -52 }, { x: 33, z: -44 }, { x: 39, z: -38 }],
  // Torches every few paces along the sewer tunnels: the only light down there.
  sewers: SEWER_TORCHES,
  'greek-feast': [{ x: -12, z: -12 }, { x: 12, z: -12 }, { x: -12, z: 12 }, { x: 12, z: 12 }, { x: 0, z: -15 }, { x: 0, z: 15 }],
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
      burning: BURNING[battle.chapter] ?? false,
      torches: TORCHES[battle.chapter] ?? [],
      ring: battle.chapter === 'the-duel' ? DUEL_RING : undefined,
      siege: battle.chapter === 'border-fort',
      sewers: battle.chapter === 'sewers',
      longship: battle.chapter === 'the-ship',
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
