import { ARMY, MAP } from './config.ts';
import type { Vec2 } from './math.ts';

export interface SpawnPoint {
  position: Vec2;
  /** Yaw facing the map center. */
  yaw: number;
}

/**
 * Armies are spread evenly on a circle around the center, far enough apart that there
 * is time to plan before the lines meet.
 */
export function armySpawnPoint(index: number, armyCount: number): SpawnPoint {
  const radius = MAP.armySpawnRadius;
  const angle = Math.PI + (index * 2 * Math.PI) / armyCount;
  const position = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  return { position, yaw: Math.atan2(-position.x, -position.z) };
}

export function allPossibleSpawnPoints(): Vec2[] {
  const points: Vec2[] = [];
  for (let count = ARMY.minArmies; count <= ARMY.maxArmies; count++) {
    for (let i = 0; i < count; i++) points.push(armySpawnPoint(i, count).position);
  }
  return points;
}
