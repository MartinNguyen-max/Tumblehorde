import { describe, expect, it } from 'vitest';
import { applyHit, shieldBlock } from '../src/combat.ts';
import { VIKING, VOLLEY } from '../src/config.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { applyCommand } from '../src/orders.ts';
import { createMatch, defaultSettings } from '../src/setup.ts';
import type { Faction, MatchState } from '../src/types.ts';
import { carriedWeapons, meleeStatsFor } from '../src/units.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;

function vikingsVsRomans(): MatchState {
  return newMatch({
    armySize: 15,
    armies: [
      { name: 'Jarl', team: 0, isBot: false, faction: 'viking' },
      { name: 'Legate', team: 1, isBot: false, faction: 'roman' },
    ],
  });
}

function run(state: MatchState, seconds: number): void {
  const inputs = new Map([[0, neutralInput()]]);
  for (let t = 0; t < seconds; t += DT) stepMatch(state, inputs, DT);
}

describe('the Viking faction', () => {
  it('carries spear and axe; draws the axe to attack and takes up the spear to hold', () => {
    const state = vikingsVsRomans();
    expect(carriedWeapons('commander', 'viking')).toContain('axe');
    expect(commanderOf(state, 0).weapon).not.toBe('sword');
    const warrior = soldiersOf(state, 0)[0]!;
    expect(warrior.faction).toBe('viking');
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    run(state, 0.1);
    expect(warrior.weapon).toBe('axe');
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    run(state, 0.1);
    expect(warrior.weapon).toBe('spear');
    expect(meleeStatsFor(warrior)).toBe(VIKING.spear);
  });

  it('axes bite through raised shields and sometimes hook them aside', () => {
    const state = vikingsVsRomans();
    const viking = place(soldiersOf(state, 0)[0]!, 0, 0, 0);
    viking.weapon = 'axe';
    const stats = meleeStatsFor(viking)!;
    let hooked = 0;
    let bitten = 0;
    const trials = 60;
    for (let i = 0; i < trials; i++) {
      const roman = place(soldiersOf(state, 1)[i % 15]!, 0, 1.5, Math.PI);
      roman.hp = roman.maxHp;
      roman.stunTimer = 0;
      roman.shieldUp = true;
      const before = roman.hp;
      applyHit(state, roman, { attacker: viking, armyId: 0, from: viking.pos, pushDir: { x: 0, z: 1 }, pierce: stats.pierce, hook: stats.hookChance }, stats.damage, stats.knockback);
      if (roman.stunTimer > 0) hooked++;
      if (before - roman.hp >= stats.damage * (stats.pierce ?? 0) - 1e-6) bitten++;
      roman.pos.x = 100 + i;
    }
    expect(bitten).toBe(trials);
    expect(hooked).toBeGreaterThan(trials * 0.15);
    expect(hooked).toBeLessThan(trials * 0.6);
  });

  it('round shields make a looser wall than the scutum', () => {
    const state = vikingsVsRomans();
    const viking = shieldBlock(soldiersOf(state, 0)[0]!);
    const roman = shieldBlock(soldiersOf(state, 1)[0]!);
    expect(viking.wall).toBeLessThan(roman.wall);
    expect(viking.alone).toBeLessThanOrEqual(roman.alone);
  });

  it('knows its own formations and not the legion’s', () => {
    const state = vikingsVsRomans();
    place(commanderOf(state, 0), -40, 0);
    place(commanderOf(state, 1), 40, 0);
    expect(applyCommand(state, 0, { type: 'formation', formation: 'boar' })).toBe(true);
    expect(applyCommand(state, 0, { type: 'formation', formation: 'swarm' })).toBe(true);
    expect(applyCommand(state, 0, { type: 'formation', formation: 'square' })).toBe(false);
    expect(applyCommand(state, 1, { type: 'formation', formation: 'boar' })).toBe(false);
    expect(applyCommand(state, 1, { type: 'formation', formation: 'square' })).toBe(true);
  });

  it('throws axes instead of pila: shorter range, spinning into the line', () => {
    const state = vikingsVsRomans();
    place(commanderOf(state, 0), -10, 0, Math.PI / 2);
    soldiersOf(state, 0).forEach((s, i) => place(s, -8, -5 + i * 0.7, Math.PI / 2));
    const far = VIKING.throwRange + 3;
    soldiersOf(state, 1).forEach((r, i) => place(r, -8 + far, i, -Math.PI / 2));
    expect(applyCommand(state, 0, { type: 'volley', at: { x: -8 + far, y: 0, z: 3 }, group: null })).toBe(false);
    expect(VIKING.throwRange).toBeLessThan(VOLLEY.range);
    soldiersOf(state, 1).forEach((r, i) => place(r, 8, i, -Math.PI / 2));
    expect(applyCommand(state, 0, { type: 'volley', at: { x: 8, y: 0, z: 3 }, group: null })).toBe(true);
    let axes = 0;
    for (let t = 0; t < 1.5; t += DT) {
      stepMatch(state, new Map([[0, neutralInput(Math.PI / 2)]]), DT);
      axes = Math.max(axes, state.arrows.filter((a) => a.kind === 'axe').length);
    }
    expect(axes).toBeGreaterThan(0);
  });
});

describe('Romans against Vikings', () => {
  it('neither people always wins: equal bot armies trade victories', () => {
    const wins: Record<Faction, number> = { roman: 0, viking: 0, bandit: 0, zombie: 0 };
    for (let seed = 1; seed <= 6; seed++) {
      const factions: [Faction, Faction] = seed % 2 === 0 ? ['viking', 'roman'] : ['roman', 'viking'];
      const state = createMatch(
        defaultSettings({
          armySize: 15,
          seed,
          armies: [
            { name: 'A', team: 0, isBot: true, faction: factions[0] },
            { name: 'B', team: 1, isBot: true, faction: factions[1] },
          ],
        }),
      );
      while (state.phase === 'playing' && state.time < 300) stepMatch(state, new Map(), DT);
      expect(state.phase).not.toBe('playing');
      const winner = state.winnerTeam === null ? null : factions[state.winnerTeam];
      if (winner) wins[winner]++;
    }
    expect(wins.roman).toBeGreaterThan(0);
    expect(wins.viking).toBeGreaterThan(0);
  }, 120_000);
});
