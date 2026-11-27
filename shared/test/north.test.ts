import { describe, expect, it } from 'vitest';
import { ICE } from '../src/config.ts';
import { stepMatch } from '../src/match.ts';
import { MAPS, NORTH } from '../src/maps.ts';
import { onIce, terrainHeightAt } from '../src/terrain.ts';
import type { MatchState, Unit } from '../src/types.ts';
import { createMatch, defaultSettings } from '../src/setup.ts';
import { killAllBut, soldiersOf } from './helpers.ts';

const DT = 1 / 30;

function northMatch(): MatchState {
  return createMatch(defaultSettings({ map: 'north', armySize: 15, armies: [{ name: 'A', team: 0, isBot: true, faction: 'viking' }, { name: 'B', team: 1, isBot: true, faction: 'roman' }] }));
}

function slideDistance(state: MatchState, unit: Unit, x: number, z: number): number {
  unit.pos = { x, y: terrainHeightAt('north', x, z), z };
  unit.vel = { x: 5, y: 0, z: 0 };
  unit.onGround = true;
  const start = unit.pos.x;
  for (let t = 0; t < 1.5; t += DT) {
    unit.intent.moveX = 0;
    unit.intent.moveZ = 0;
    stepMatch(state, new Map(), DT);
  }
  return unit.pos.x - start;
}

describe('the frozen north', () => {
  it('has a flat frozen lake a little below the snow', () => {
    const lake = NORTH.ice[0]!;
    expect(onIce('north', lake.x, lake.z)).toBe(true);
    expect(onIce('meadow', lake.x, lake.z)).toBe(false);
    expect(terrainHeightAt('north', lake.x, lake.z)).toBeCloseTo(NORTH.iceLevel, 3);
    expect(terrainHeightAt('north', lake.x + lake.radiusX * 0.5, lake.z)).toBeCloseTo(NORTH.iceLevel, 3);
    expect(MAPS.north.structures.length).toBeGreaterThan(5);
  });

  it('ice is slippery: a body slides much further before it stops', () => {
    const state = northMatch();
    const unit = soldiersOf(state, 0)[0]!;
    killAllBut(state, [unit]);
    state.time = 0;
    const lake = NORTH.ice[0]!;
    const onSnow = slideDistance(state, unit, -60, -70);
    const onTheLake = slideDistance(state, unit, lake.x - 10, lake.z);
    expect(onTheLake).toBeGreaterThan(onSnow * 2);
    expect(ICE.tractionFactor).toBeLessThan(1);
  });

  it('soldiers running on the ice go down now and then', () => {
    const state = northMatch();
    const lake = NORTH.ice[0]!;
    const runners = soldiersOf(state, 0).slice(0, 10);
    killAllBut(state, runners);
    let slips = 0;
    for (let t = 0; t < 12; t += DT) {
      for (const [i, u] of runners.entries()) {
        if (!u.onIce || Math.abs(u.pos.x - lake.x) > lake.radiusX * 0.6) u.pos = { x: lake.x - 12, y: NORTH.iceLevel, z: lake.z - 6 + i * 1.2 };
        if (u.stunTimer <= 0) u.vel.x = 5;
      }
      stepMatch(state, new Map(), DT);
      slips += state.events.filter((e) => e.type === 'stumble').length;
    }
    expect(slips).toBeGreaterThan(0);
  });

  it('Romans and Vikings fight it out to the end up here', () => {
    const state = northMatch();
    while (state.phase === 'playing' && state.time < 300) stepMatch(state, new Map(), DT);
    expect(state.phase).not.toBe('playing');
  }, 60_000);
});
