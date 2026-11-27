import { describe, expect, it } from 'vitest';
import { battleResult, campaignBattle, HERO_NAMES, STORY_BATTLE } from '../src/campaign/battles.ts';
import { CHAPTERS, type ChapterId } from '../src/campaign/chapters.ts';
import { newSave } from '../src/campaign/save.ts';
import { HERO, ZOMBIE } from '../src/config.ts';
import { killUnit } from '../src/combat.ts';
import { declareVictory, stepMatch } from '../src/match.ts';
import { livingSoldiers } from '../src/orders.ts';
import { createMatch } from '../src/setup.ts';
import type { MatchState } from '../src/types.ts';

const DT = 1 / 30;

function run(state: MatchState, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepMatch(state, new Map(), DT);
}

function saveAt(chapter: ChapterId, eirikSpared: boolean | null = null): ReturnType<typeof newSave> {
  const save = newSave(0);
  return { ...save, chapter, choices: { ...save.choices, eirikSpared } };
}

describe('the story battles', () => {
  it('every battle chapter has a battle that starts', () => {
    for (const chapter of CHAPTERS.filter((c) => c.kind === 'battle')) {
      const battle = campaignBattle(chapter.id, saveAt(chapter.id, true));
      expect(battle, chapter.id).not.toBeNull();
      const state = createMatch(battle!.settings);
      expect(state.armies[0]?.commanderId).not.toBeNull();
      run(state, 1);
      expect(state.phase).toBe('playing');
    }
    expect(campaignBattle('prologue', saveAt('prologue'))).toBeNull();
  });

  it('the forest road: Cassian and Varro, the two villagers, five bandits', () => {
    const battle = campaignBattle('forest-road', saveAt('forest-road'))!;
    const state = createMatch(battle.settings);
    const heroes = state.units.filter((u) => u.hero !== null).map((u) => u.hero);
    expect(heroes.sort()).toEqual([HERO_NAMES.felix, HERO_NAMES.rufus, HERO_NAMES.varro].sort());
    expect(livingSoldiers(state, state.armies[2]!)).toHaveLength(STORY_BATTLE.bandits);
    expect(state.armies[2]?.faction).toBe('bandit');
  });

  it('the legion fights with the men it has left, and Eirik only if he was spared', () => {
    const save = saveAt('bridge', false);
    save.legion[0]!.alive = false;
    const battle = campaignBattle('bridge', save)!;
    expect(battle.legionNames).toHaveLength(save.legion.length - 1);
    expect(battle.settings.armies[0]?.heroes).not.toContain(HERO_NAMES.eirik);
    expect(campaignBattle('bridge', saveAt('bridge', true))!.settings.armies[0]?.heroes).toContain(HERO_NAMES.eirik);
  });

  it('heroes are knocked down, never killed, and get back up', () => {
    const battle = campaignBattle('burning-village', saveAt('burning-village'))!;
    const state = createMatch(battle.settings);
    const varro = state.units.find((u) => u.hero === HERO_NAMES.varro)!;
    killUnit(state, varro, 2, { x: 1, y: 1, z: 0 });
    expect(varro.alive).toBe(false);
    expect(state.armies[0]?.stats.deaths).toBe(0);
    run(state, HERO.getUpTime + 0.5);
    expect(varro.alive).toBe(true);
    expect(varro.hp).toBeCloseTo(varro.maxHp * HERO.getUpHealth);
  });

  it('reports who fell, and Hrolf going down', () => {
    const battle = campaignBattle('last-battle', saveAt('last-battle'))!;
    const state = createMatch(battle.settings);
    const army = state.armies[0]!;
    const heroes = army.soldierIds.filter((id) => state.units[id]?.hero !== null).length;
    killUnit(state, state.units[army.soldierIds[heroes + 2]!]!, 3, { x: 0, y: 1, z: 0 });
    const hrolf = state.units[state.armies[3]!.commanderId!]!;
    expect(hrolf.maxHp).toBeGreaterThan(state.units[army.commanderId!]!.maxHp * 2);
    killUnit(state, hrolf, 0, { x: 0, y: 1, z: 0 });
    declareVictory(state, 0);
    const result = battleResult(battle, state);
    expect(result.won).toBe(true);
    expect(result.fallenNames).toEqual([battle.legionNames[2]]);
    expect(result.warlordDefeated).toBe(true);
  });

  it('the second wave waits before it comes', () => {
    const battle = campaignBattle('bridge', saveAt('bridge'))!;
    const state = createMatch(battle.settings);
    const wave = state.armies[2]!;
    const start = livingSoldiers(state, wave).map((u) => ({ ...u.pos }));
    run(state, STORY_BATTLE.bridgeSecondWaveAt * 0.5);
    const moved = livingSoldiers(state, wave).map((u, i) => Math.hypot(u.pos.x - start[i]!.x, u.pos.z - start[i]!.z));
    expect(Math.max(...moved)).toBeLessThan(4);
  });

  it('the dead keep coming on the last night, and never break', () => {
    const save = saveAt('last-night');
    save.choices.lastStand = 'tunnel';
    const battle = campaignBattle('last-night', save)!;
    expect(battle.goal.kind).toBe('lastStand');
    const state = createMatch(battle.settings);
    const dead = state.armies[3]!;
    expect(state.units[dead.soldierIds[0]!]?.maxHp).toBe(ZOMBIE.hp);
    for (const id of dead.soldierIds) killUnit(state, state.units[id]!, 0, { x: 0, y: 1, z: 0 });
    run(state, STORY_BATTLE.zombieWave.every + 0.5);
    expect(dead.eliminated).toBe(false);
    expect(livingSoldiers(state, dead).length).toBeGreaterThanOrEqual(STORY_BATTLE.zombieWave.count);
    expect(state.phase).toBe('playing');
  });
});

describe('the story maps', () => {
  it('every place a story battle starts an army is open, dry ground', async () => {
    const { CAMPAIGN_MAP_IDS, MAPS } = await import('../src/maps.ts');
    const { insideStructure, mapStructures } = await import('../src/structures.ts');
    const { inWater, mapObstacles } = await import('../src/terrain.ts');
    for (const map of CAMPAIGN_MAP_IDS) {
      for (const p of Object.values(MAPS[map].points ?? {})) {
        expect(mapStructures(map).some((s) => insideStructure(s, p.x, p.z, 1)), `${map} ${p.x},${p.z}`).toBe(false);
        expect(inWater(map, p.x, p.z)).toBe(false);
        expect(mapObstacles(map).some((o) => o.radius > 0 && Math.hypot(o.x - p.x, o.z - p.z) < 6)).toBe(false);
      }
    }
    for (const chapter of CHAPTERS.filter((c) => c.kind === 'battle')) {
      const battle = campaignBattle(chapter.id, saveAt(chapter.id, true))!;
      for (const setup of battle.settings.armies) {
        const p = setup.spawn!;
        expect(mapStructures(battle.settings.map).some((s) => insideStructure(s, p.x, p.z, 2)), `${chapter.id} ${setup.name}`).toBe(false);
        expect(inWater(battle.settings.map, p.x, p.z), `${chapter.id} ${setup.name}`).toBe(false);
      }
    }
  });
});

describe('review fixes for story battles', () => {
  it('a story army that is wiped out loses, even with heroes on the ground', async () => {
    const { campaignBattle: build } = await import('../src/campaign/battles.ts');
    const battle = build('bridge', saveAt('bridge', true))!;
    const state = createMatch(battle.settings);
    for (let t = 0; t < 20 && state.phase === 'playing'; t += DT) {
      for (const u of state.units) if (u.alive && state.armies[u.armyId]?.team === 0) killUnit(state, u, 1, { x: 0, y: 1, z: 0 });
      stepMatch(state, new Map(), DT);
    }
    expect(state.phase).not.toBe('playing');
    expect(state.winnerTeam).toBe(1);
    expect(battleResult(battle, state).won).toBe(false);
  });

  it('holding out wins at the clock, and nobody cheers while enemies still stand', async () => {
    const { checkStoryGoal } = await import('../src/campaign/battles.ts');
    const { isCelebrating } = await import('../src/celebration.ts');
    const battle = campaignBattle('bridge', saveAt('bridge'))!;
    const state = createMatch(battle.settings);
    state.time = STORY_BATTLE.bridgeHold - DT / 2;
    expect(checkStoryGoal(state, battle)).toBeNull();
    stepMatch(state, new Map(), DT);
    expect(checkStoryGoal(state, battle)).toBe('won');
    expect(state.winnerTeam).toBe(0);
    expect(isCelebrating(state, state.armies[0]!)).toBe(false);
  });

  it('the last night ends when Cassian first falls', async () => {
    const { checkStoryGoal } = await import('../src/campaign/battles.ts');
    const battle = campaignBattle('last-night', saveAt('last-night'))!;
    const state = createMatch(battle.settings);
    expect(checkStoryGoal(state, battle)).toBeNull();
    killUnit(state, state.units[state.armies[0]!.commanderId!]!, 3, { x: 0, y: 1, z: 0 });
    expect(checkStoryGoal(state, battle)).toBe('lost');
    expect(state.endTimer).toBe(STORY_BATTLE.lastStandAftermath);
  });
});

describe('horses in the story', () => {
  it('Cassian has no horse before the Emperor, nor in the dark forest; he rides at the bridge', () => {
    const mounted = (chapter: ChapterId): boolean => {
      const state = createMatch(campaignBattle(chapter, saveAt(chapter))!.settings);
      return state.units[state.armies[0]!.commanderId!]!.mountId !== null;
    };
    expect(mounted('forest-road')).toBe(false);
    expect(mounted('dark-forest')).toBe(false);
    expect(mounted('bridge')).toBe(true);
    expect(mounted('last-night')).toBe(true);
  });
});
