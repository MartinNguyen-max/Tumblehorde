import {
  ARCHER,
  BODY,
  COMMANDER,
  HORSE,
  RIDER,
  SWORDSMAN,
  type MeleeStats,
  type RangedStats,
} from './config.ts';
import type { Vec3 } from './math.ts';
import type { EntityId, Intent, MatchState, Unit, UnitKind } from './types.ts';

export function emptyIntent(yaw: number): Intent {
  return { moveX: 0, moveZ: 0, faceYaw: yaw, jump: false, attack: false, shield: false };
}

export function maxHpFor(kind: UnitKind): number {
  switch (kind) {
    case 'commander':
      return COMMANDER.hp;
    case 'swordsman':
      return SWORDSMAN.hp;
    case 'archer':
      return ARCHER.hp;
    case 'rider':
      return RIDER.hp;
    case 'horse':
      return HORSE.hp;
  }
}

export function createUnit(id: EntityId, kind: UnitKind, armyId: number, pos: Vec3, yaw: number): Unit {
  const hp = maxHpFor(kind);
  return {
    id,
    kind,
    armyId,
    hp,
    maxHp: hp,
    alive: true,
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw,
    onGround: true,
    stunTimer: 0,
    action: 'none',
    actionTimer: 0,
    cooldownTimer: 0,
    shieldUp: false,
    mountId: null,
    riderId: null,
    group: 0,
    lastHitByArmy: null,
    invulnerableTimer: 0,
    respawnTimer: 0,
    intent: emptyIntent(yaw),
    ai: { targetId: null, thinkTimer: 0, shieldTimer: 0, chargePoint: null, horseTargetId: null },
  };
}

export function isHorse(unit: Unit): boolean {
  return unit.kind === 'horse';
}

export function isPerson(unit: Unit): boolean {
  return unit.kind !== 'horse';
}

export function isSoldier(unit: Unit): boolean {
  return unit.kind === 'swordsman' || unit.kind === 'archer' || unit.kind === 'rider';
}

export function isMounted(unit: Unit): boolean {
  return unit.mountId !== null;
}

export function bodyRadius(unit: Unit): number {
  return isHorse(unit) ? BODY.horseRadius : BODY.personRadius;
}

export function bodyMass(unit: Unit): number {
  return isHorse(unit) ? BODY.horseMass : BODY.personMass;
}

export function meleeStatsForKind(kind: UnitKind, mounted: boolean): MeleeStats | null {
  switch (kind) {
    case 'commander':
      return mounted ? COMMANDER.mountedMelee : COMMANDER.melee;
    case 'swordsman':
      return SWORDSMAN.melee;
    case 'archer':
      return ARCHER.melee;
    case 'rider':
      return mounted ? RIDER.mountedMelee : RIDER.melee;
    case 'horse':
      return null;
  }
}

export function meleeStatsFor(unit: Unit): MeleeStats | null {
  return meleeStatsForKind(unit.kind, isMounted(unit));
}

export function rangedStatsFor(unit: Unit): RangedStats | null {
  return unit.kind === 'archer' ? ARCHER.ranged : null;
}

export function canUseShield(unit: Unit): boolean {
  if (isMounted(unit)) return false;
  return unit.kind === 'commander' || unit.kind === 'swordsman' || unit.kind === 'rider';
}

export function footSpeed(unit: Unit): number {
  switch (unit.kind) {
    case 'commander':
      return COMMANDER.speed;
    case 'swordsman':
      return SWORDSMAN.speed;
    case 'archer':
      return ARCHER.speed;
    case 'rider':
      return RIDER.speed;
    case 'horse':
      return HORSE.speed;
  }
}

export function getUnit(state: MatchState, id: EntityId | null): Unit | null {
  if (id === null) return null;
  return state.units[id] ?? null;
}

export function teamOf(state: MatchState, unit: Unit): number {
  return state.armies[unit.armyId]?.team ?? -1;
}

export function areEnemies(state: MatchState, a: Unit, b: Unit): boolean {
  return teamOf(state, a) !== teamOf(state, b);
}

/** The person you would actually hit: the rider of a ridden horse counts as the target. */
export function canBeTargeted(unit: Unit): boolean {
  if (!unit.alive) return false;
  if (isHorse(unit)) return false;
  return unit.invulnerableTimer <= 0;
}
