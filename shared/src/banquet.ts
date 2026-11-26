import { BANQUET } from './config.ts';
import { ringRadius, ringSlots, type FormationSlot } from './formation.ts';
import { normalizeXZ, type Vec2 } from './math.ts';
import { nextRandom } from './random.ts';
import { applyKnockback, knockbackVector } from './combat.ts';
import type { Army, EntityId, Intent, MatchState, Unit } from './types.ts';
import { getUnit, isMounted } from './units.ts';

/** The feast is over (time is up, an order came, or the commander fell): everyone is drunk from now on. */
export function finishFeast(state: MatchState, army: Army): void {
  if (army.banquet !== 'feasting') return;
  army.banquet = 'drunk';
  army.feastTimer = 0;
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (unit?.alive) unit.drunk = true;
  }
  state.events.push({ type: 'drunk', armyId: army.id });
}

export function updateBanquets(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    army.rallyTimer = Math.max(0, army.rallyTimer - dt);
    if (army.banquet !== 'feasting') continue;
    army.feastTimer -= dt;
    const commander = getUnit(state, army.commanderId);
    if (army.feastTimer <= 0 || !commander?.alive) finishFeast(state, army);
  }
}

/** Feasting soldiers stand in a ring around the commander, facing in towards the wine. */
export function feastSlots(center: Vec2, soldiers: readonly Unit[]): Map<EntityId, FormationSlot> {
  const radius = ringRadius(soldiers.length) + BANQUET.gatherExtraRadius;
  const slots = ringSlots(soldiers.length, center, 0).map((slot) => {
    const out = normalizeXZ(slot.x - center.x, slot.z - center.z);
    return { x: center.x + out.x * radius, z: center.z + out.z * radius, yaw: slot.yaw + Math.PI };
  });
  const result = new Map<EntityId, FormationSlot>();
  soldiers.forEach((s, i) => {
    const slot = slots[i];
    if (slot) result.set(s.id, slot);
  });
  return result;
}

/**
 * A drunk never walks straight: the direction wobbles, and standing still they drift around
 * their place. Deterministic (time and id), so server and clients agree.
 */
export function staggerIntent(intent: Intent, id: EntityId, time: number): void {
  const phase = time * BANQUET.swaySpeed + id * 1.7;
  const moving = Math.hypot(intent.moveX, intent.moveZ);
  if (moving < 0.05) {
    intent.moveX += Math.sin(phase * 0.6) * BANQUET.idleDrift;
    intent.moveZ += Math.cos(phase * 0.45 + id) * BANQUET.idleDrift;
  } else {
    const angle = Math.sin(phase) * BANQUET.swayAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = intent.moveX * cos - intent.moveZ * sin;
    const z = intent.moveX * sin + intent.moveZ * cos;
    intent.moveX = x;
    intent.moveZ = z;
  }
  intent.faceYaw += Math.sin(phase * 1.3) * BANQUET.swayAngle * 0.4;
}

/** Running drunks now and then trip over their own feet and go flat on their face. */
export function updateStumbles(state: MatchState, dt: number): void {
  for (const unit of state.units) {
    if (!unit.drunk || !unit.alive || isMounted(unit) || unit.stunTimer > 0 || !unit.onGround) continue;
    const speed = Math.hypot(unit.vel.x, unit.vel.z);
    if (speed < BANQUET.tripMinSpeed || nextRandom(state.rng) > BANQUET.tripPerSecond * dt) continue;
    const forward = normalizeXZ(unit.vel.x, unit.vel.z);
    applyKnockback(unit, knockbackVector(forward, BANQUET.tripPop), BANQUET.tripStun);
    state.events.push({ type: 'stumble', unitId: unit.id });
  }
}
