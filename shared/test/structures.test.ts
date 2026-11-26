import { describe, expect, it } from 'vitest';
import { CASTLE, CITY, MAP_IDS, MAPS } from '../src/maps.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { allPossibleSpawnPoints } from '../src/spawn.ts';
import { hitsStructure, insideStructure, mapStructures, resolveStructures, steerAroundStructures } from '../src/structures.ts';
import { mapObstacles } from '../src/terrain.ts';
import { commanderOf, newMatch, place } from './helpers.ts';

const DT = 1 / 30;

describe('structures', () => {
  it('every battlefield has some', () => {
    for (const map of MAP_IDS) expect(mapStructures(map).length).toBeGreaterThan(3);
  });

  it('the castle has a curtain wall with one open gate facing west, towers and a keep', () => {
    const castle = mapStructures('castle');
    expect(castle.some((s) => s.kind === 'keep')).toBe(true);
    expect(castle.filter((s) => s.kind === 'tower').length).toBeGreaterThanOrEqual(6);
    expect(castle.some((s) => insideStructure(s, CASTLE.west, 0, 0.5))).toBe(false);
    expect(castle.some((s) => insideStructure(s, CASTLE.west, CASTLE.halfDepth / 2))).toBe(true);
  });

  it('the city has open avenues, a forum and many houses', () => {
    const city = mapStructures('city');
    expect(city.filter((s) => s.kind === 'house').length).toBeGreaterThan(30);
    for (let x = -70; x <= 70; x += 5) {
      expect(city.some((s) => insideStructure(s, x, 0, 0.5))).toBe(false);
      expect(city.some((s) => insideStructure(s, 0, x, 0.5)) && Math.abs(x) > CITY.forumHalf).toBe(false);
    }
  });

  it('stay clear of spawn points, and trees and rocks stay off them', () => {
    for (const map of MAP_IDS) {
      for (const s of mapStructures(map)) {
        for (const spawn of allPossibleSpawnPoints(map)) expect(insideStructure(s, spawn.x, spawn.z, 6)).toBe(false);
        for (const o of mapObstacles(map)) if (o.radius > 0) expect(insideStructure(s, o.x, o.z)).toBe(false);
      }
    }
  });

  it('block walking', () => {
    const state = newMatch({ map: 'castle' });
    const input = { ...neutralInput(Math.PI / 2), moveX: 1 };
    const me = place(commanderOf(state, 0), CASTLE.west - 6, 0, Math.PI / 2);
    for (let t = 0; t < 2.5; t += DT) stepMatch(state, new Map([[0, input]]), DT);
    expect(me.pos.x).toBeGreaterThan(CASTLE.west + 2);
    const blocked = place(commanderOf(state, 0), CASTLE.west - 6, 16, Math.PI / 2);
    for (let t = 0; t < 2.5; t += DT) stepMatch(state, new Map([[0, input]]), DT);
    expect(blocked.pos.x).toBeLessThan(CASTLE.west);
  });

  it('push bodies out and steer AI along the wall', () => {
    const state = newMatch({ map: 'castle' });
    const unit = place(commanderOf(state, 0), CASTLE.west - 0.4, 16);
    resolveStructures(unit, 'castle');
    expect(Math.abs(unit.pos.x - CASTLE.west)).toBeGreaterThan(1);
    place(unit, CASTLE.west - 3, 16);
    unit.intent.moveX = 1;
    unit.intent.moveZ = 0.1;
    steerAroundStructures(unit, 'castle');
    expect(Math.abs(unit.intent.moveZ)).toBeGreaterThan(0.9);
  });

  it('stop arrows', () => {
    const wall = MAPS.castle.structures.find((s) => s.kind === 'wall')!;
    expect(hitsStructure('castle', { x: wall.x, y: 1, z: wall.z }, 0)).toBe(true);
    expect(hitsStructure('castle', { x: wall.x, y: 20, z: wall.z }, 0)).toBe(false);
  });
});
