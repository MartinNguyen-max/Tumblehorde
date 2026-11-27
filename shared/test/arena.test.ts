import { describe, expect, it } from 'vitest';
import { ARENA, arenaSettings, type FighterKit } from '../src/campaign/index.ts';
import { killUnit } from '../src/combat.ts';
import { MAP_IDS, isMapChoice, mapFromRandom } from '../src/maps.ts';
import { stepMatch } from '../src/match.ts';
import { createMatch, defaultSettings } from '../src/setup.ts';
import { getUnit } from '../src/units.ts';

const DT = 1 / 60;
const PLAYER: FighterKit = { hp: 150, damage: 1, block: 1 };
const POOR: FighterKit = { hp: 90, damage: 0.8, block: 0.8 };

function arena(opponents = 3) {
  return createMatch(arenaSettings(PLAYER, Array.from({ length: opponents }, (_, i) => ({ name: `Poor man ${i + 1}`, kit: POOR })), 3));
}

describe('arena', () => {
  it('puts the player alone and on foot, and each opponent alone, all on the ring', () => {
    const state = arena();
    const you = state.armies[0]!;
    const commander = getUnit(state, you.commanderId)!;
    expect(you.soldierIds).toHaveLength(0);
    expect(commander.mountId).toBeNull();
    expect(commander.maxHp).toBe(PLAYER.hp);
    expect(state.units.some((u) => u.kind === 'horse')).toBe(false);
    for (const army of state.armies.slice(1)) {
      expect(army.commanderId).toBeNull();
      expect(army.soldierIds).toHaveLength(1);
      const fighter = getUnit(state, army.soldierIds[0] ?? null)!;
      expect(fighter.maxHp).toBe(POOR.hp);
      expect(Math.hypot(fighter.pos.x, fighter.pos.z)).toBeLessThan(ARENA.floorRadius);
    }
  });

  it('going down is final: the player does not get back up', () => {
    const state = arena(1);
    const commander = getUnit(state, state.armies[0]!.commanderId)!;
    killUnit(state, commander, 1, { x: 0, y: 0, z: 0 });
    for (let t = 0; t < 30; t += DT) stepMatch(state, new Map(), DT);
    expect(commander.alive).toBe(false);
    expect(state.armies[0]!.eliminated).toBe(true);
    expect(state.phase).not.toBe('playing');
  });

  it('bot fighters go for each other and the fight ends', () => {
    const state = arena();
    // The player stands aside; the three bots fight it out.
    killUnit(state, getUnit(state, state.armies[0]!.commanderId)!, null, { x: 0, y: 0, z: 0 });
    for (let t = 0; t < 120 && state.phase === 'playing'; t += DT) stepMatch(state, new Map(), DT);
    expect(state.phase).not.toBe('playing');
  });

  it('never comes up as a random or lobby battlefield', () => {
    for (let r = 0; r < 1; r += 0.01) expect(mapFromRandom(r)).not.toBe('arena');
    expect(isMapChoice('arena')).toBe(false);
    expect(MAP_IDS).not.toContain('arena');
  });

  it('leaves ordinary battles unchanged', () => {
    const state = createMatch(defaultSettings());
    const commander = getUnit(state, state.armies[0]!.commanderId)!;
    expect(commander.mountId).not.toBeNull();
    expect(state.armies[0]!.soldierIds.length).toBeGreaterThan(1);
  });
});
