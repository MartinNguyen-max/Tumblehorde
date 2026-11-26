import { BODY, COMMANDER, HORSE, MAP, MOVEMENT, SHIELD, SIM } from './config.ts';
import { applyHit } from './combat.ts';
import { dirToYaw, normalizeXZ, turnTowards, wrapAngle, yawToDir } from './math.ts';
import { syncRiderToHorse } from './mounts.ts';
import { mapObstacles, terrainHeightAt } from './terrain.ts';
import type { MapId } from './maps.ts';
import type { MatchState, Unit } from './types.ts';
import { areEnemies, bodyMass, bodyRadius, footSpeed, getUnit, isHorse, isMounted } from './units.ts';

export function jumpVelocity(): number {
  return Math.sqrt(2 * SIM.gravity * COMMANDER.jumpHeight);
}

/** Moves the horizontal velocity towards a target velocity by at most `maxDelta`. */
function accelerateTowards(unit: Unit, targetX: number, targetZ: number, maxDelta: number): void {
  const dx = targetX - unit.vel.x;
  const dz = targetZ - unit.vel.z;
  const len = Math.hypot(dx, dz);
  if (len <= maxDelta || len < 1e-6) {
    unit.vel.x = targetX;
    unit.vel.z = targetZ;
    return;
  }
  unit.vel.x += (dx / len) * maxDelta;
  unit.vel.z += (dz / len) * maxDelta;
}

function applyFriction(unit: Unit, dt: number): void {
  if (unit.onGround) accelerateTowards(unit, 0, 0, SIM.groundFriction * dt);
}

export function clampedMove(unit: Unit): { x: number; z: number; amount: number } {
  const len = Math.hypot(unit.intent.moveX, unit.intent.moveZ);
  if (len < 1e-3) return { x: 0, z: 0, amount: 0 };
  const amount = Math.min(1, len);
  return { x: unit.intent.moveX / len, z: unit.intent.moveZ / len, amount };
}

export function personSpeed(unit: Unit): number {
  let speed = footSpeed(unit);
  if (unit.shieldUp) speed *= SHIELD.speedFactor;
  if (unit.action !== 'none') speed *= MOVEMENT.attackingSpeedFactor;
  return speed;
}

/** Applies the unit's intent to its velocity and facing. Persons on foot only. */
export function steerPerson(unit: Unit, dt: number): void {
  if (unit.stunTimer > 0) {
    applyFriction(unit, dt);
    return;
  }
  const move = clampedMove(unit);
  const speed = personSpeed(unit) * move.amount;
  const accel = unit.onGround ? SIM.groundAccel : SIM.airAccel;
  accelerateTowards(unit, move.x * speed, move.z * speed, accel * dt);
  unit.yaw = turnTowards(unit.yaw, unit.intent.faceYaw, BODY.personTurnRate * dt);
  if (unit.intent.jump && unit.onGround) {
    unit.vel.y = jumpVelocity();
    unit.onGround = false;
  }
}

/** Horses only run forward and turn slowly, so cavalry sweeps in wide arcs. */
export function steerHorse(state: MatchState, horse: Unit, dt: number): void {
  const rider = getUnit(state, horse.riderId);
  if (!rider || !rider.alive || horse.stunTimer > 0) {
    accelerateTowards(horse, 0, 0, BODY.horseAccel * dt);
    return;
  }
  const move = clampedMove(rider);
  if (move.amount < 0.1) {
    accelerateTowards(horse, 0, 0, BODY.horseAccel * dt);
    return;
  }
  const wanted = dirToYaw(move.x, move.z);
  horse.yaw = turnTowards(horse.yaw, wanted, BODY.horseTurnRate * dt);
  const alignment = Math.max(MOVEMENT.horseMinTurnSpeedFactor, Math.cos(wrapAngle(wanted - horse.yaw)));
  const forward = yawToDir(horse.yaw);
  const speed = HORSE.speed * move.amount * alignment;
  accelerateTowards(horse, forward.x * speed, forward.z * speed, BODY.horseAccel * dt);
}

export function integrateBody(unit: Unit, dt: number, map: MapId): void {
  const startVelY = unit.vel.y;
  if (!unit.onGround) unit.vel.y -= SIM.gravity * dt;
  unit.pos.x += unit.vel.x * dt;
  // Average velocity keeps jump arcs exact regardless of the tick rate.
  unit.pos.y += ((startVelY + unit.vel.y) / 2) * dt;
  unit.pos.z += unit.vel.z * dt;
  settleOnGround(unit, map);
}

function settleOnGround(unit: Unit, map: MapId): void {
  const ground = terrainHeightAt(map, unit.pos.x, unit.pos.z);
  if (unit.pos.y <= ground) {
    unit.pos.y = ground;
    if (unit.vel.y < 0) unit.vel.y = 0;
    unit.onGround = true;
    return;
  }
  const walkingDownhill = unit.onGround && unit.vel.y <= 0 && unit.pos.y - ground < SIM.groundSnap;
  if (walkingDownhill) {
    unit.pos.y = ground;
    unit.vel.y = 0;
  } else {
    unit.onGround = false;
  }
}

/** Invisible walls: anything past the edge is pushed back inwards. Returns true if pushed. */
export function applyMapEdge(unit: Unit): boolean {
  const limit = MAP.halfSize;
  const hard = MAP.halfSize + MAP.edgeHardOvershoot;
  let pushed = false;
  if (unit.pos.x > limit) {
    unit.vel.x = Math.min(unit.vel.x, -MAP.edgePushSpeed);
    unit.pos.x = Math.min(unit.pos.x, hard);
    pushed = true;
  } else if (unit.pos.x < -limit) {
    unit.vel.x = Math.max(unit.vel.x, MAP.edgePushSpeed);
    unit.pos.x = Math.max(unit.pos.x, -hard);
    pushed = true;
  }
  if (unit.pos.z > limit) {
    unit.vel.z = Math.min(unit.vel.z, -MAP.edgePushSpeed);
    unit.pos.z = Math.min(unit.pos.z, hard);
    pushed = true;
  } else if (unit.pos.z < -limit) {
    unit.vel.z = Math.max(unit.vel.z, MAP.edgePushSpeed);
    unit.pos.z = Math.max(unit.pos.z, -hard);
    pushed = true;
  }
  return pushed;
}

export function distanceToEdge(x: number, z: number): number {
  return MAP.halfSize - Math.max(Math.abs(x), Math.abs(z));
}

export function resolveObstacles(unit: Unit, map: MapId): void {
  const radius = bodyRadius(unit);
  for (const obstacle of mapObstacles(map)) {
    if (obstacle.radius <= 0) continue;
    const dx = unit.pos.x - obstacle.x;
    const dz = unit.pos.z - obstacle.z;
    const minDistance = obstacle.radius + radius;
    const distSq = dx * dx + dz * dz;
    if (distSq >= minDistance * minDistance) continue;
    const dist = Math.sqrt(distSq);
    const n = dist > 1e-6 ? { x: dx / dist, z: dz / dist } : { x: 1, z: 0 };
    unit.pos.x = obstacle.x + n.x * minDistance;
    unit.pos.z = obstacle.z + n.z * minDistance;
    const into = unit.vel.x * n.x + unit.vel.z * n.z;
    if (into < 0) {
      unit.vel.x -= n.x * into;
      unit.vel.z -= n.z * into;
    }
  }
}

const GRID_CELL = 2;

function cellKey(x: number, z: number): number {
  return (Math.floor(x / GRID_CELL) + 512) * 1024 + (Math.floor(z / GRID_CELL) + 512);
}

/** Bodies that physically occupy space: living horses and persons on foot. */
function isSolid(unit: Unit): boolean {
  return unit.alive && !isMounted(unit);
}

/** Pushes overlapping bodies apart and lets galloping horses trample enemies. */
export function separateBodies(state: MatchState): void {
  const grid = new Map<number, Unit[]>();
  for (const unit of state.units) {
    if (!isSolid(unit)) continue;
    const key = cellKey(unit.pos.x, unit.pos.z);
    const bucket = grid.get(key);
    if (bucket) bucket.push(unit);
    else grid.set(key, [unit]);
  }
  for (const unit of state.units) {
    if (!isSolid(unit)) continue;
    const cx = Math.floor(unit.pos.x / GRID_CELL);
    const cz = Math.floor(unit.pos.z / GRID_CELL);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const bucket = grid.get((cx + ox + 512) * 1024 + (cz + oz + 512));
        if (!bucket) continue;
        for (const other of bucket) {
          if (other.id <= unit.id) continue;
          resolvePair(state, unit, other);
        }
      }
    }
  }
}

function resolvePair(state: MatchState, a: Unit, b: Unit): void {
  if (!a.alive || !b.alive) return;
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const minDistance = bodyRadius(a) + bodyRadius(b);
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDistance * minDistance) return;
  if (Math.abs(a.pos.y - b.pos.y) > BODY.personHeight * 0.8) return;
  tryTrample(state, a, b);
  tryTrample(state, b, a);
  const dist = Math.sqrt(distSq);
  const n = dist > 1e-6 ? normalizeXZ(dx, dz) : { x: 1, z: 0 };
  const overlap = minDistance - dist;
  const massA = bodyMass(a);
  const massB = bodyMass(b);
  const shareA = massB / (massA + massB);
  a.pos.x -= n.x * overlap * shareA;
  a.pos.z -= n.z * overlap * shareA;
  b.pos.x += n.x * overlap * (1 - shareA);
  b.pos.z += n.z * overlap * (1 - shareA);
}

function tryTrample(state: MatchState, horse: Unit, victim: Unit): void {
  if (!isHorse(horse) || isHorse(victim) || horse.riderId === null) return;
  if (!victim.alive || victim.stunTimer > 0 || victim.invulnerableTimer > 0) return;
  const rider = getUnit(state, horse.riderId);
  if (!rider || !areEnemies(state, rider, victim)) return;
  const speed = Math.hypot(horse.vel.x, horse.vel.z);
  if (speed < HORSE.trampleMinSpeed) return;
  const pushDir = normalizeXZ(horse.vel.x, horse.vel.z);
  state.events.push({ type: 'trample', horseId: horse.id, targetId: victim.id });
  applyHit(state, victim, { attacker: rider, armyId: rider.armyId, from: horse.pos, pushDir }, HORSE.trampleDamage, HORSE.trample);
}

/** Runs one movement step for every unit: steering, gravity, ground, edges, obstacles, crowding. */
export function stepMovement(state: MatchState, dt: number): void {
  for (const unit of state.units) {
    if (!unit.alive || isMounted(unit)) continue;
    if (isHorse(unit)) steerHorse(state, unit, dt);
    else steerPerson(unit, dt);
    integrateBody(unit, dt, state.settings.map);
    if (applyMapEdge(unit) && unit.kind === 'commander') {
      state.events.push({ type: 'edgePush', unitId: unit.id });
    }
    if (isHorse(unit) && unit.riderId !== null) {
      const rider = getUnit(state, unit.riderId);
      if (rider?.kind === 'commander' && distanceToEdge(unit.pos.x, unit.pos.z) < 0) {
        state.events.push({ type: 'edgePush', unitId: rider.id });
      }
    }
    resolveObstacles(unit, state.settings.map);
  }
  separateBodies(state);
  for (const unit of state.units) {
    if (!unit.alive || unit.mountId === null) continue;
    const horse = getUnit(state, unit.mountId);
    if (!horse) continue;
    syncRiderToHorse(unit, horse);
    if (unit.stunTimer <= 0) unit.yaw = turnTowards(unit.yaw, unit.intent.faceYaw, BODY.personTurnRate * dt);
  }
}
