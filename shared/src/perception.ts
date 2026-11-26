import { PERCEPTION } from './config.ts';
import { CITY, MAPS } from './maps.ts';
import { distanceXZ, type Vec2 } from './math.ts';
import { clearPath, isWalkable } from './navigation.ts';
import { nextRandom } from './random.ts';
import type { Army, MatchState, Unit } from './types.ts';
import { areEnemies, canBeTargeted, getUnit } from './units.ts';

/**
 * Fog of war in the city: houses block sight, so soldiers only fight what they (or someone
 * in their army) can see. Elsewhere everyone sees everyone.
 */
export function fogOfWar(state: MatchState): boolean {
  return MAPS[state.settings.map].layout === 'city';
}

export function canSee(state: MatchState, viewer: Unit, target: Unit): boolean {
  if (!fogOfWar(state)) return true;
  return distanceXZ(viewer.pos, target.pos) <= PERCEPTION.sightRange && clearPath(state.settings.map, viewer.pos, target.pos);
}

/** The nearest enemy within `maxDistance` of `from` that `unit` can actually see. */
export function nearestVisibleEnemy(state: MatchState, unit: Unit, maxDistance: number, from: Vec2 = unit.pos): Unit | null {
  const candidates: { unit: Unit; d: number }[] = [];
  for (const other of state.units) {
    if (!canBeTargeted(other) || !areEnemies(state, unit, other)) continue;
    const d = distanceXZ(from, other.pos);
    if (d < maxDistance) candidates.push({ unit: other, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  const fog = fogOfWar(state);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) break;
    if (!fog) return candidate.unit;
    if (i >= PERCEPTION.maxSightChecks) break;
    if (canSee(state, unit, candidate.unit)) return candidate.unit;
  }
  return null;
}

/** Whoever spots an enemy shouts it out: the whole army now knows where to go. */
export function reportSighting(state: MatchState, army: Army, at: Vec2): void {
  army.intel = { x: at.x, z: at.z, time: state.time };
  army.searchPoint = null;
}

/** A soldier (or the commander) looks around and reports what they see. */
export function lookAround(state: MatchState, unit: Unit): Unit | null {
  const army = state.armies[unit.armyId];
  const seen = nearestVisibleEnemy(state, unit, PERCEPTION.sightRange);
  if (seen && army) reportSighting(state, army, seen.pos);
  return seen;
}

function soldiersOf(state: MatchState, army: Army): Unit[] {
  return army.soldierIds.map((id) => state.units[id]).filter((u): u is Unit => u?.alive === true);
}

function centerOf(units: readonly Unit[]): Vec2 | null {
  if (units.length === 0) return null;
  return { x: units.reduce((s, u) => s + u.pos.x, 0) / units.length, z: units.reduce((s, u) => s + u.pos.z, 0) / units.length };
}

/** Street corners worth checking, all over the city. */
function searchSpots(state: MatchState): Vec2[] {
  const spots: Vec2[] = [];
  for (const x of CITY.lines) for (const z of CITY.lines) if (isWalkable(state.settings.map, x, z)) spots.push({ x, z });
  return spots;
}

function pickSearchPoint(state: MatchState, from: Vec2): Vec2 | null {
  const spots = searchSpots(state).filter((p) => distanceXZ(p, from) > PERCEPTION.searchMinDistance);
  if (spots.length === 0) return null;
  return spots[Math.floor(nextRandom(state.rng) * spots.length)] ?? null;
}

/** Forgets old sightings, and keeps an army that has to attack blind moving from corner to corner. */
export function updateIntel(state: MatchState, dt: number): void {
  if (!fogOfWar(state)) return;
  for (const army of state.armies) {
    if (army.eliminated) continue;
    const commander = getUnit(state, army.commanderId);
    if (commander?.alive && state.tick % PERCEPTION.commanderLookEvery === 0) lookAround(state, commander);
    const soldiers = soldiersOf(state, army);
    const intel = army.intel;
    if (intel) {
      const stale = state.time - intel.time > PERCEPTION.intelMemory;
      const reached = soldiers.some((s) => distanceXZ(s.pos, intel) < PERCEPTION.intelClearRadius);
      if (stale || (reached && state.time - intel.time > 1)) army.intel = null;
    }
    const searching = !army.intel && army.groupOrders.some((g) => g.order === 'attack');
    if (!searching) {
      army.searchPoint = null;
      continue;
    }
    army.searchTimer -= dt;
    const center = centerOf(soldiers);
    if (!center) continue;
    const arrived = army.searchPoint !== null && distanceXZ(center, army.searchPoint) < PERCEPTION.searchArriveRadius;
    if (!army.searchPoint || arrived || army.searchTimer <= 0) {
      army.searchPoint = pickSearchPoint(state, center);
      army.searchTimer = PERCEPTION.searchRetarget;
    }
  }
}

/** Where attacking soldiers head when nobody is in sight: the last sighting, or the search. */
export function attackGoal(state: MatchState, army: Army): Vec2 | null {
  if (!fogOfWar(state)) return null;
  if (army.intel) return { x: army.intel.x, z: army.intel.z };
  return army.searchPoint;
}
