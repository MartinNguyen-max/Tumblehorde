import { describe, expect, it } from 'vitest';
import { MAP, OBSTACLES, TERRAIN } from '../src/config.ts';
import { distanceXZ } from '../src/math.ts';
import { allPossibleSpawnPoints, armySpawnPoint } from '../src/spawn.ts';
import { mapObstacles, terrainHeightAt, terrainHeightGrid, TERRAIN_VERTS } from '../src/terrain.ts';

describe('terrain', () => {
  it('is flat in the middle of the map', () => {
    expect(terrainHeightAt(0, 0)).toBeCloseTo(0);
    expect(terrainHeightAt(10, -12)).toBeCloseTo(0);
  });

  it('matches the grid exactly at grid vertices', () => {
    const grid = terrainHeightGrid();
    const i = 40;
    const j = 51;
    const x = -TERRAIN.extent + i * TERRAIN.cellSize;
    const z = -TERRAIN.extent + j * TERRAIN.cellSize;
    expect(terrainHeightAt(x, z)).toBeCloseTo(grid[j * TERRAIN_VERTS + i] ?? NaN, 5);
  });

  it('is continuous across cell borders', () => {
    for (let x = -60; x < 60; x += 7.3) {
      const border = Math.round(x / TERRAIN.cellSize) * TERRAIN.cellSize;
      expect(Math.abs(terrainHeightAt(border - 1e-4, 33.3) - terrainHeightAt(border + 1e-4, 33.3))).toBeLessThan(1e-2);
    }
  });

  it('rises into rim hills outside the playable map', () => {
    expect(terrainHeightAt(TERRAIN.extent - 1, 0)).toBeGreaterThan(terrainHeightAt(MAP.halfSize, 0));
  });
});

describe('spawn points', () => {
  it.each([2, 3, 4])('places %i armies 60 m from their neighbours', (count) => {
    for (let i = 0; i < count; i++) {
      const a = armySpawnPoint(i, count).position;
      const b = armySpawnPoint((i + 1) % count, count).position;
      expect(distanceXZ(a, b)).toBeCloseTo(MAP.armySpawnDistance, 5);
      expect(Math.max(Math.abs(a.x), Math.abs(a.z))).toBeLessThan(MAP.halfSize - 20);
    }
  });

  it('faces the map center', () => {
    const spawn = armySpawnPoint(0, 2);
    expect(spawn.position.x).toBeLessThan(0);
    expect(Math.sin(spawn.yaw)).toBeGreaterThan(0.99);
  });
});

describe('obstacles', () => {
  it('are deterministic', () => {
    expect(mapObstacles()).toBe(mapObstacles());
    expect(mapObstacles().length).toBeGreaterThan(OBSTACLES.treesInsideMap);
  });

  it('keep spawn areas clear', () => {
    const solid = mapObstacles().filter((o) => o.radius > 0);
    for (const spawn of allPossibleSpawnPoints()) {
      for (const o of solid) expect(distanceXZ(spawn, o)).toBeGreaterThanOrEqual(OBSTACLES.keepClearOfSpawn);
    }
  });
});
