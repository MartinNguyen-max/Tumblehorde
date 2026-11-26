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
import type { EntityId, Intent, MatchState, Unit, UnitKind, Weapon } from './types.ts';

export function emptyIntent(yaw: number): Intent {
  return { moveX: 0, moveZ: 0, faceYaw: yaw, jump: false, attack: false, shield: false, aim: null };
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

export function defaultWeapon(kind: UnitKind): Weapon {
  if (kind === 'archer') return 'bow';
  if (kind === 'rider') return 'spear';
  return 'sword';
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
    weapon: defaultWeapon(kind),
    sinceHurt: 0,
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

export function meleeStatsForKind(kind: UnitKind, mounted: boolean, weapon: Weapon = defaultWeapon(kind)): MeleeStats | null {
  switch (kind) {
    case 'commander':
      if (weapon === 'bow') return null;
      if (weapon === 'spear') return mounted ? COMMANDER.mountedSpear : COMMANDER.spear;
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
  return meleeStatsForKind(unit.kind, isMounted(unit), unit.weapon);
}

export function rangedStatsFor(unit: Unit): RangedStats | null {
  if (unit.kind === 'archer') return ARCHER.ranged;
  if (unit.kind === 'commander' && unit.weapon === 'bow') return COMMANDER.bow;
  return null;
}

export function canUseShield(unit: Unit): boolean {
  if (isMounted(unit)) return false;
  if (unit.kind === 'commander') return unit.weapon !== 'bow';
  return unit.kind === 'swordsman' || unit.kind === 'rider';
}

/** Commanders carry sword, spear and bow; switching takes a moment and cancels a swing. */
export function setWeapon(unit: Unit, weapon: Weapon): boolean {
  if (unit.kind !== 'commander' || !unit.alive || unit.weapon === weapon) return false;
  unit.weapon = weapon;
  unit.action = 'none';
  unit.actionTimer = 0;
  unit.shieldUp = false;
  unit.cooldownTimer = Math.max(unit.cooldownTimer, COMMANDER.weaponSwapTime);
  return true;
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

/** A ridden horse fights for its rider's side, even if it was taken from another army. */
export function sideArmyId(state: MatchState, unit: Unit): number {
  if (unit.riderId === null) return unit.armyId;
  return state.units[unit.riderId]?.armyId ?? unit.armyId;
}

export function teamOf(state: MatchState, unit: Unit): number {
  return state.armies[sideArmyId(state, unit)]?.team ?? -1;
}

export function areEnemies(state: MatchState, a: Unit, b: Unit): boolean {
  return teamOf(state, a) !== teamOf(state, b);
}

/** What a swing can connect with: people, and horses nobody is riding. */
export function canBeStruck(unit: Unit): boolean {
  if (!unit.alive || unit.invulnerableTimer > 0) return false;
  return !isHorse(unit) || unit.riderId === null;
}

/** The person you would actually hit: the rider of a ridden horse counts as the target. */
export function canBeTargeted(unit: Unit): boolean {
  if (!unit.alive) return false;
  if (isHorse(unit)) return false;
  return unit.invulnerableTimer <= 0;
}
