import { describe, expect, it } from 'vitest';
import { MAP, OBSTACLES, TERRAIN } from '../src/config.ts';
import { MAP_IDS, MAPS, mapFromRandom } from '../src/maps.ts';
import { distanceXZ } from '../src/math.ts';
import { battleSettings } from '../src/net.ts';
import { allPossibleSpawnPoints, armySpawnPoint } from '../src/spawn.ts';
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
    expect(solid.length).toBeGreaterThan(expected * 0.8);
    for (const spawn of allPossibleSpawnPoints()) {
      for (const o of solid) expect(distanceXZ(spawn, o)).toBeGreaterThanOrEqual(OBSTACLES.keepClearOfSpawn);
    }
  });
});

describe('maps', () => {
  it('differ from each other', () => {
    const heights = MAP_IDS.map((m) => terrainHeightAt(m, 40, 30).toFixed(3));
    expect(new Set(heights).size).toBe(MAP_IDS.length);
    expect(new Set(MAP_IDS.map((m) => mapObstacles(m)[0]?.kind)).size).toBeGreaterThan(1);
  });

  it('are picked at random for online battles', () => {
    expect(mapFromRandom(0)).toBe('meadow');
    expect(mapFromRandom(0.999)).toBe('highlands');
    const lobby = { code: 'ABCDE', hostId: 'a', phase: 'lobby' as const, mode: 'ffa' as const, armySize: 15 as const, players: [] };
    const picked = new Set(Array.from({ length: 40 }, (_, seed) => battleSettings(lobby, seed).map));
    expect(picked.size).toBe(MAP_IDS.length);
  });
});

describe('spawn points', () => {
  it.each([2, 3, 4])('places %i armies far apart but inside the map', (count) => {
    for (let i = 0; i < count; i++) {
      const a = armySpawnPoint(i, count).position;
      const b = armySpawnPoint((i + 1) % count, count).position;
      expect(distanceXZ(a, b)).toBeGreaterThan(75);
      expect(Math.max(Math.abs(a.x), Math.abs(a.z))).toBeLessThanOrEqual(MAP.halfSize - 20);
    }
  });

  it('faces the map center', () => {
    const spawn = armySpawnPoint(0, 2);
    expect(spawn.position.x).toBeLessThan(0);
    expect(Math.sin(spawn.yaw)).toBeGreaterThan(0.99);
  });
});
