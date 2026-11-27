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

  it("the story's raiders come as a horde: many, weak, and all at once", () => {
    const battle = campaignBattle('bridge', saveAt('bridge'))!;
    const state = createMatch(battle.settings);
    const legion = livingSoldiers(state, state.armies[0]!).length;
    const vikings = livingSoldiers(state, state.armies[1]!).length + livingSoldiers(state, state.armies[2]!).length;
    expect(vikings).toBeGreaterThan(legion * 2);
    const viking = livingSoldiers(state, state.armies[1]!)[0]!;
    const legionary = livingSoldiers(state, state.armies[0]!).find((u) => u.hero === null)!;
    expect(viking.maxHp).toBeLessThan(legionary.maxHp);
    expect(state.armies[1]!.bot.style).toBe('rush');
    expect(state.armies[2]!.bot.style).toBe('rush');
    expect(battle.settings.armies[2]!.arriveAt ?? 0).toBe(0);
  });

  it('teaches as it goes: the bridge starts with the men out of order until two lines are picked', async () => {
    const { tutorialStepDone } = await import('../src/campaign/battles.ts');
    const { applyCommand } = await import('../src/orders.ts');
    const battle = campaignBattle('bridge', saveAt('bridge'))!;
    const state = createMatch(battle.settings);
    expect(state.armies[0]!.formation).toBe('swarm');
    const step = battle.tutorial[0]!;
    expect(step.points).toBe('hold');
    expect(tutorialStepDone(step, state, 0)).toBe(false);
    applyCommand(state, 0, { type: 'formation', formation: 'double' });
    expect(tutorialStepDone(step, state, 0)).toBe(true);
    const forest = campaignBattle('forest-road', saveAt('forest-road'))!;
    expect(forest.tutorial[0]!.done).toEqual({ order: 'follow' });
    expect(forest.settings.prepareTime).toBe(0);
  });

  it('the Mongols ride: every one on a horse, with a saber; a second band comes round the flank', () => {
    const battle = campaignBattle('open-field', saveAt('open-field'))!;
    const state = createMatch(battle.settings);
    const mongols = state.armies.filter((a) => a.name === 'Mongols');
    expect(mongols).toHaveLength(2);
    for (const army of mongols) {
      for (const soldier of livingSoldiers(state, army)) {
        expect(soldier.kind).toBe('rider');
        expect(soldier.mountId).not.toBeNull();
        expect(soldier.weapon).toBe('sword');
      }
    }
    expect(battle.settings.armies.find((a) => a.name === 'Mongols' && a.arriveAt)?.arriveAt).toBe(STORY_BATTLE.mongolFlankAt);
    expect(battle.settings.armies.some((a) => a.name === 'Hrolf')).toBe(false);
  });

  it('Hrolf rides with Cassian against the Mongols, but only if he was spared', () => {
    const save = saveAt('open-field');
    save.choices.hrolfSpared = true;
    const battle = campaignBattle('open-field', save)!;
    const hrolf = battle.settings.armies.find((a) => a.name === 'Hrolf');
    expect(hrolf?.team).toBe(0);
    expect(battle.commanders[battle.warlordArmy!]).toBe('Jorgai the Hawk');
  });

  it('the gate: Cassian alone, on foot, against five', () => {
    const battle = campaignBattle('the-gate', saveAt('the-gate'))!;
    const state = createMatch(battle.settings);
    expect(livingSoldiers(state, state.armies[0]!)).toHaveLength(0);
    expect(state.units[state.armies[0]!.commanderId!]!.mountId).toBeNull();
    expect(livingSoldiers(state, state.armies[1]!)).toHaveLength(STORY_BATTLE.streetMongols);
  });

  it('the last patrol is a last stand: the Greeks keep coming', () => {
    const battle = campaignBattle('last-patrol', saveAt('last-patrol'))!;
    expect(battle.goal.kind).toBe('lastStand');
    expect(battle.onLoss).toBe('continue');
    const state = createMatch(battle.settings);
    const greeks = state.armies[1]!;
    for (const id of greeks.soldierIds) killUnit(state, state.units[id]!, 0, { x: 0, y: 1, z: 0 });
    run(state, STORY_BATTLE.greekWave.every + 0.5);
    expect(livingSoldiers(state, greeks).length).toBeGreaterThanOrEqual(STORY_BATTLE.greekWave.count);
    expect(state.phase).toBe('playing');
  });

  it('the brothers: the player leads the son they chose; Marcus fights beside the dead', () => {
    const lucius = campaignBattle('brothers', { ...saveAt('brothers'), choices: { eirikSpared: null, hrolfSpared: null, son: 'lucius' } })!;
    expect(lucius.settings.armies[0]!.name).toBe('Lucius');
    expect(lucius.settings.armies[0]!.isBot).toBe(false);
    const marcus = campaignBattle('brothers', { ...saveAt('brothers'), choices: { eirikSpared: null, hrolfSpared: null, son: 'marcus' } })!;
    expect(marcus.settings.armies[0]!.name).toBe('Marcus');
    expect(marcus.settings.armies[0]!.isBot).toBe(false);
    const dead = marcus.settings.armies.find((a) => a.faction === 'zombie')!;
    expect(dead.team).toBe(marcus.settings.armies[0]!.team);
    const state = createMatch(marcus.settings);
    expect(state.units[state.armies[0]!.commanderId!]!.mountId).not.toBeNull();
    expect(livingSoldiers(state, state.armies[1]!)[0]?.maxHp).toBe(ZOMBIE.hp);
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

  it('the last patrol ends when Cassian first falls', async () => {
    const { checkStoryGoal } = await import('../src/campaign/battles.ts');
    const battle = campaignBattle('last-patrol', saveAt('last-patrol'))!;
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
    expect(mounted('open-field')).toBe(true);
    expect(mounted('the-gate')).toBe(false);
  });
});

describe('veterans', () => {
  it('survivors of a deadly battle come back tougher', () => {
    const save = saveAt('outpost');
    save.legion[1]!.veteran = true;
    const battle = campaignBattle('outpost', save)!;
    const state = createMatch(battle.settings);
    const army = state.armies[0]!;
    const heroes = army.soldierIds.filter((id) => state.units[id]?.hero !== null).length;
    const plain = state.units[army.soldierIds[heroes]!]!;
    const veteran = state.units[army.soldierIds[heroes + 1]!]!;
    expect(veteran.maxHp).toBeCloseTo(plain.maxHp * STORY_BATTLE.veteranToughness);
  });
});

describe('the campaign keeps the army whole', () => {
  it('refuses to split the army in two', async () => {
    const { applyCommand } = await import('../src/orders.ts');
    const battle = campaignBattle('bridge', saveAt('bridge'))!;
    const state = createMatch(battle.settings);
    expect(applyCommand(state, 0, { type: 'split', groupCount: 2 })).toBe(false);
    expect(state.armies[0]!.groupCount).not.toBe(2);
  });
});
