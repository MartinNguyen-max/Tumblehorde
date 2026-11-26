import { describe, expect, it } from 'vitest';
import { MAP_IDS, MAPS } from '../src/maps.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { allPossibleSpawnPoints } from '../src/spawn.ts';
import { hitsStructure, insideStructure, mapStructures, resolveStructures, steerAroundStructures } from '../src/structures.ts';
import { mapObstacles } from '../src/terrain.ts';
import { commanderOf, newMatch, place } from './helpers.ts';

describe('structures', () => {
  it('every battlefield has some', () => {
    for (const map of MAP_IDS) expect(mapStructures(map).length).toBeGreaterThan(3);
  });

  it('the rocky battlefield has a walled village with houses and gates', () => {
    const kinds = mapStructures('highlands').map((s) => s.kind);
    expect(kinds.filter((k) => k === 'house').length).toBeGreaterThanOrEqual(8);
    expect(kinds.filter((k) => k === 'wall').length).toBeGreaterThanOrEqual(8);
    // The roads through the gates are open.
    expect(mapStructures('highlands').some((s) => insideStructure(s, 26, 0, 0.5))).toBe(false);
    expect(mapStructures('highlands').some((s) => insideStructure(s, 0, 26, 0.5))).toBe(false);
  });

  it('stay clear of spawn points, and trees and rocks stay off them', () => {
    for (const map of MAP_IDS) {
      for (const s of mapStructures(map)) {
        for (const spawn of allPossibleSpawnPoints()) expect(insideStructure(s, spawn.x, spawn.z, 10)).toBe(false);
        for (const o of mapObstacles(map)) if (o.radius > 0) expect(insideStructure(s, o.x, o.z)).toBe(false);
      }
    }
  });

  it('block walking', () => {
    const state = newMatch({ map: 'highlands' });
    const me = place(commanderOf(state, 0), 0, 30, Math.PI);
    const input = { ...neutralInput(Math.PI), moveZ: -1 };
    for (let t = 0; t < 2; t += 1 / 30) stepMatch(state, new Map([[0, input]]), 1 / 30);
    // The wall runs along z = 26 except at the gate; walking south from x = 0 goes through the gate.
    expect(me.pos.z).toBeLessThan(26);
    const blocked = place(commanderOf(state, 0), 14, 30, Math.PI);
    for (let t = 0; t < 2; t += 1 / 30) stepMatch(state, new Map([[0, input]]), 1 / 30);
    expect(blocked.pos.z).toBeGreaterThan(26);
  });

  it('push bodies out and steer AI along the wall', () => {
    const state = newMatch({ map: 'highlands' });
    const unit = place(commanderOf(state, 0), 14, 26.2);
    resolveStructures(unit, 'highlands');
    expect(Math.abs(unit.pos.z - 26)).toBeGreaterThan(0.5);
    place(unit, 14, 28);
    unit.intent.moveX = 0.1;
    unit.intent.moveZ = -1;
    steerAroundStructures(unit, 'highlands');
    expect(Math.abs(unit.intent.moveX)).toBeGreaterThan(0.9);
  });

  it('stop arrows', () => {
    const wall = MAPS.highlands.structures.find((s) => s.kind === 'wall')!;
    expect(hitsStructure('highlands', { x: wall.x, y: 1, z: wall.z }, 0)).toBe(true);
    expect(hitsStructure('highlands', { x: wall.x, y: 10, z: wall.z }, 0)).toBe(false);
  });
});
