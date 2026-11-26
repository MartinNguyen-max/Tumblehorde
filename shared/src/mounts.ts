import { BODY, HORSE } from './config.ts';
import { distanceXZ, yawToDir } from './math.ts';
import { randomRange } from './random.ts';
import { terrainHeightAt } from './terrain.ts';
import type { MatchState, Unit } from './types.ts';
import { getUnit, isHorse } from './units.ts';

export function canMount(rider: Unit, horse: Unit): boolean {
  return (
    rider.alive &&
    rider.mountId === null &&
    rider.stunTimer <= 0 &&
    (rider.kind === 'commander' || rider.kind === 'rider') &&
    isHorse(horse) &&
    horse.alive &&
    horse.riderId === null
  );
}

export function nearestFreeHorse(state: MatchState, unit: Unit, maxDistance: number): Unit | null {
  let best: Unit | null = null;
  let bestDistance = maxDistance;
  for (const other of state.units) {
    if (!canMount(unit, other)) continue;
    const d = distanceXZ(unit.pos, other.pos);
    if (d <= bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

export function mount(state: MatchState, rider: Unit, horse: Unit): boolean {
  if (!canMount(rider, horse)) return false;
  rider.mountId = horse.id;
  horse.riderId = rider.id;
  horse.armyId = rider.armyId;
  rider.shieldUp = false;
  rider.action = 'none';
  rider.actionTimer = 0;
  syncRiderToHorse(rider, horse);
  state.events.push({ type: 'mount', riderId: rider.id, horseId: horse.id });
  return true;
}

/** Puts the rider back on their feet beside the horse. */
export function dismount(state: MatchState, rider: Unit): boolean {
  const horse = getUnit(state, rider.mountId);
  if (!horse) return false;
  placeBesideHorse(rider, horse);
  rider.vel = { ...horse.vel, y: 0 };
  state.events.push({ type: 'dismount', riderId: rider.id, horseId: horse.id, thrown: false });
  return true;
}

/** The horse died: the rider is thrown off in a goofy arc and stunned. */
export function throwRider(state: MatchState, rider: Unit, horse: Unit): void {
  placeBesideHorse(rider, horse);
  const side = randomRange(state.rng, -1, 1) >= 0 ? 1 : -1;
  const facing = yawToDir(horse.yaw);
  rider.vel = {
    x: horse.vel.x * 0.5 + facing.z * side * HORSE.fallThrowSpeed,
    y: HORSE.fallThrowSpeed,
    z: horse.vel.z * 0.5 - facing.x * side * HORSE.fallThrowSpeed,
  };
  rider.pos.y = horse.pos.y + BODY.saddleHeight;
  rider.onGround = false;
  rider.stunTimer = HORSE.fallStun;
  rider.action = 'none';
  state.events.push({ type: 'dismount', riderId: rider.id, horseId: horse.id, thrown: true });
}

function placeBesideHorse(rider: Unit, horse: Unit): void {
  const facing = yawToDir(horse.yaw);
  const offset = BODY.horseRadius + BODY.personRadius + 0.1;
  rider.pos.x = horse.pos.x + facing.z * offset;
  rider.pos.z = horse.pos.z - facing.x * offset;
  rider.pos.y = terrainHeightAt(rider.pos.x, rider.pos.z);
  rider.onGround = true;
  rider.mountId = null;
  horse.riderId = null;
}

export function syncRiderToHorse(rider: Unit, horse: Unit): void {
  rider.pos.x = horse.pos.x;
  rider.pos.y = horse.pos.y + BODY.saddleHeight;
  rider.pos.z = horse.pos.z;
  rider.vel.x = horse.vel.x;
  rider.vel.y = horse.vel.y;
  rider.vel.z = horse.vel.z;
  rider.onGround = horse.onGround;
}

export function toggleMount(state: MatchState, unit: Unit): boolean {
  if (!unit.alive) return false;
  if (unit.mountId !== null) return dismount(state, unit);
  const horse = nearestFreeHorse(state, unit, HORSE.mountRange);
  return horse ? mount(state, unit, horse) : false;
}
