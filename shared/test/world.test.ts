import { describe, expect, it } from 'vitest';
import { MAP, OBSTACLES, TERRAIN } from '../src/config.ts';
import { CASTLE, MAP_IDS, MAPS, mapFromRandom } from '../src/maps.ts';
import { distanceXZ } from '../src/math.ts';
import { battleSettings } from '../src/net.ts';
import { allPossibleSpawnPoints, armySpawn, isDefender } from '../src/spawn.ts';
import type { ArmySetup } from '../src/types.ts';
import { mapObstacles, terrainHeightAt, terrainHeightGrid, TERRAIN_VERTS } from '../src/terrain.ts';

describe.each(MAP_IDS)('terrain of %s', (map) => {
  it('is flat in the middle of the map', () => {
    expect(terrainHeightAt(map, 0, 0)).toBeCloseTo(0);
    expect(terrainHeightAt(map, 8, -10)).toBeCloseTo(0);
  });

  it('matches the grid exactly at grid vertices', () => {
    const grid = terrainHeightGrid(map);
    const i = 40;
    const j = 51;
    const x = -TERRAIN.extent + i * TERRAIN.cellSize;
    const z = -TERRAIN.extent + j * TERRAIN.cellSize;
    expect(terrainHeightAt(map, x, z)).toBeCloseTo(grid[j * TERRAIN_VERTS + i] ?? NaN, 5);
  });

  it('is continuous across cell borders', () => {
    for (let x = -60; x < 60; x += 7.3) {
      const border = Math.round(x / TERRAIN.cellSize) * TERRAIN.cellSize;
      expect(Math.abs(terrainHeightAt(map, border - 1e-4, 33.3) - terrainHeightAt(map, border + 1e-4, 33.3))).toBeLessThan(1e-2);
    }
  });

  it('rises into rim hills outside the playable map', () => {
    expect(terrainHeightAt(map, TERRAIN.extent - 1, 0)).toBeGreaterThan(terrainHeightAt(map, MAP.halfSize, 0));
  });

  it('has deterministic obstacles that keep spawn areas clear', () => {
    expect(mapObstacles(map)).toBe(mapObstacles(map));
    const solid = mapObstacles(map).filter((o) => o.radius > 0);
    const expected = MAPS[map].inside.reduce((n, g) => n + g.count, 0);
    expect(solid.length).toBeGreaterThanOrEqual(expected * 0.8);
    for (const spawn of allPossibleSpawnPoints(map)) {
      for (const o of solid) expect(distanceXZ(spawn, o)).toBeGreaterThanOrEqual(OBSTACLES.keepClearOfSpawn);
    }
  });
});

describe('maps', () => {
  it('are a meadow, a castle, a city and the frozen north', () => {
    expect(MAP_IDS).toEqual(['meadow', 'castle', 'city', 'north']);
    expect(new Set(MAP_IDS.map((m) => MAPS[m].layout)).size).toBe(3);
  });

  it('are picked at random for online battles when the lobby asks for it', () => {
    expect(mapFromRandom(0)).toBe('meadow');
    expect(mapFromRandom(0.999)).toBe('north');
    const lobby = { code: 'ABCDE', hostId: 'a', phase: 'lobby' as const, peoples: 'romans' as const, mode: 'ffa' as const, armySize: 15 as const, map: 'random' as const, players: [] };
    const picked = new Set(Array.from({ length: 40 }, (_, seed) => battleSettings(lobby, seed).map));
    expect(picked.size).toBe(MAP_IDS.length);
  });
});

function armies(count: number, teams: number[] = []): ArmySetup[] {
  return Array.from({ length: count }, (_, i) => ({ name: `A${i}`, team: teams[i] ?? i, isBot: true }));
}

describe('spawn points', () => {
  it.each([2, 3, 4])('places %i armies far apart but inside the map', (count) => {
    for (const map of MAP_IDS) {
      const settings = { map, mode: 'ffa' as const, armies: armies(count) };
      for (let i = 0; i < count; i++) {
        const a = armySpawn(settings, i).position;
        const b = armySpawn(settings, (i + 1) % count).position;
        expect(distanceXZ(a, b)).toBeGreaterThan(45);
        expect(Math.max(Math.abs(a.x), Math.abs(a.z))).toBeLessThanOrEqual(MAP.halfSize - 20);
      }
    }
  });

  it('faces the map center on the meadow', () => {
    const spawn = armySpawn({ map: 'meadow', mode: 'ffa', armies: armies(2) }, 0);
    expect(spawn.position.x).toBeLessThan(0);
    expect(Math.sin(spawn.yaw)).toBeGreaterThan(0.99);
  });

  it('puts the castle defender (team 0) inside the walls and everyone else outside', () => {
    const settings = { map: 'castle' as const, mode: 'teams' as const, armies: armies(3, [1, 0, 1]) };
    expect(isDefender(settings, 1)).toBe(true);
    expect(isDefender(settings, 0)).toBe(false);
    expect(armySpawn(settings, 1).position.x).toBeGreaterThan(CASTLE.west);
    expect(armySpawn(settings, 0).position.x).toBeLessThan(CASTLE.west);
    expect(armySpawn(settings, 2).position.x).toBeLessThan(CASTLE.west);
    expect(isDefender({ ...settings, map: 'meadow' }, 1)).toBe(false);
    // Free-for-all at the castle: whoever is marked holds it, everyone else fights for themselves.
    const ffa = { map: 'castle' as const, mode: 'ffa' as const, armies: armies(3).map((a, i) => ({ ...a, defends: i === 2 })) };
    expect([0, 1, 2].map((i) => isDefender(ffa, i))).toEqual([false, false, true]);
    expect(new Set(ffa.armies.map((a) => a.team)).size).toBe(3);
  });
});
