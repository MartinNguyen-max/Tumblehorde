import {
  ARCHER,
  BANQUET,
  BODY,
  COMMANDER,
  COMMANDER_WEAPONS,
  HORSE,
  RIDER,
  SHIELD,
  SWORDSMAN,
  BANDIT,
  ZOMBIE,
  VIKING,
  VIKING_COMMANDER_WEAPONS,
  type MeleeStats,
  type RangedStats,
} from './config.ts';
import type { Vec3 } from './math.ts';
import type { EntityId, Faction, Intent, MatchState, Unit, UnitKind, Weapon } from './types.ts';

export function emptyIntent(yaw: number): Intent {
  return { moveX: 0, moveZ: 0, faceYaw: yaw, jump: false, attack: false, shield: false, crouch: false, aim: null };
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

const CARRIED: Record<UnitKind, readonly Weapon[]> = {
  commander: COMMANDER_WEAPONS,
  // Spear for marching and holding, the sword comes out to attack.
  swordsman: ['spear', 'sword'],
  archer: ['bow'],
  rider: ['spear'],
  horse: [],
};

/** What each people carries where it differs from the legion. */
const FACTION_CARRIED: Record<Faction, Partial<Record<UnitKind, readonly Weapon[]>>> = {
  roman: {},
  // Spear for marching and the shield wall, the axe comes out to attack.
  viking: { commander: VIKING_COMMANDER_WEAPONS, swordsman: ['spear', 'axe'] },
  // Raiders on horseback (the Mongols) swing curved sabers, not lances.
  bandit: { swordsman: ['sword'], rider: ['sword'] },
  zombie: { swordsman: ['claw'], commander: ['claw'] },
};

export function carriedWeapons(kind: UnitKind, faction: Faction = 'roman'): readonly Weapon[] {
  return FACTION_CARRIED[faction][kind] ?? CARRIED[kind];
}

/** The close-combat weapon a soldier draws to attack. */
export function attackWeapon(faction: Faction): Weapon {
  switch (faction) {
    case 'viking':
      return 'axe';
    case 'zombie':
      return 'claw';
    case 'roman':
    case 'bandit':
      return 'sword';
  }
}

/** The weapon a soldier holds a line with: a spear, if their people carry one. */
export function holdWeapon(faction: Faction): Weapon {
  return faction === 'roman' || faction === 'viking' ? 'spear' : attackWeapon(faction);
}

/** Bandits and the dead are not as tough as soldiers (or tougher). */
export function maxHpOf(kind: UnitKind, faction: Faction): number {
  if (kind !== 'swordsman') return maxHpFor(kind);
  if (faction === 'bandit') return BANDIT.hp;
  if (faction === 'zombie') return ZOMBIE.hp;
  return maxHpFor(kind);
}

export function defaultWeapon(kind: UnitKind, faction: Faction = 'roman'): Weapon {
  return carriedWeapons(kind, faction)[0] ?? 'sword';
}

export function createUnit(id: EntityId, kind: UnitKind, armyId: number, pos: Vec3, yaw: number, faction: Faction = 'roman'): Unit {
  const hp = maxHpOf(kind, faction);
  return {
    id,
    kind,
    armyId,
    faction,
    hero: null,
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
    weapon: defaultWeapon(kind, faction),
    sinceHurt: 0,
    lastHitByArmy: null,
    invulnerableTimer: 0,
    respawnTimer: 0,
    drunk: false,
    wet: false,
    onIce: false,
    crouching: false,
    spearThrown: false,
    intent: emptyIntent(yaw),
    ai: { targetId: null, thinkTimer: 0, shieldTimer: 0, chargePoint: null, horseTargetId: null, watchId: null, navGoal: null, navPoint: null, navTimer: 0, throwTargetId: null, throwAt: null, revengeId: null, revengeTime: -Infinity, circleSign: id % 2 === 0 ? 1 : -1, circleTimer: 0, dodgeTimer: 0, dodgeX: 0, dodgeZ: 0, bashNext: false, bashing: false },
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
  if (isHorse(unit)) return BODY.horseMass;
  if (unit.drunk) return BANQUET.mass;
  return unit.shieldUp && !isMounted(unit) ? SHIELD.bracedMass : BODY.personMass;
}

export function meleeStatsForKind(kind: UnitKind, mounted: boolean, weapon: Weapon = defaultWeapon(kind)): MeleeStats | null {
  switch (kind) {
    case 'commander':
      if (weapon === 'bow') return null;
      if (weapon === 'spear') return mounted ? COMMANDER.mountedSpear : COMMANDER.spear;
      if (weapon === 'axe') return mounted ? VIKING.mountedAxe : VIKING.commanderAxe;
      if (weapon === 'claw') return ZOMBIE.claw;
      return mounted ? COMMANDER.mountedMelee : COMMANDER.melee;
    case 'swordsman':
      if (weapon === 'axe') return VIKING.axe;
      if (weapon === 'claw') return ZOMBIE.claw;
      return weapon === 'spear' ? SWORDSMAN.spear : SWORDSMAN.melee;
    case 'archer':
      return ARCHER.melee;
    case 'rider':
      return mounted ? RIDER.mountedMelee : RIDER.melee;
    case 'horse':
      return null;
  }
}

export function meleeStatsFor(unit: Unit): MeleeStats | null {
  if (unit.faction === 'viking' && unit.kind === 'swordsman' && unit.weapon === 'spear') return VIKING.spear;
  if (unit.faction === 'bandit' && unit.kind === 'swordsman') return BANDIT.sword;
  return meleeStatsForKind(unit.kind, isMounted(unit), unit.weapon);
}

export function rangedStatsFor(unit: Unit): RangedStats | null {
  if (unit.kind === 'archer') return ARCHER.ranged;
  if (unit.kind === 'commander' && unit.weapon === 'bow') return COMMANDER.bow;
  return null;
}

export function canUseShield(unit: Unit): boolean {
  if (unit.faction === 'zombie') return false;
  if (unit.kind === 'commander') return unit.weapon !== 'bow';
  return unit.kind === 'swordsman' || unit.kind === 'rider';
}

/** Switches to another carried weapon; it takes a moment and cancels a swing. */
export function setWeapon(unit: Unit, weapon: Weapon): boolean {
  if (!unit.alive || unit.weapon === weapon || !carriedWeapons(unit.kind, unit.faction).includes(weapon)) return false;
  unit.weapon = weapon;
  unit.action = 'none';
  unit.actionTimer = 0;
  unit.shieldUp = false;
  const swapTime = unit.kind === 'commander' ? COMMANDER.weaponSwapTime : SWORDSMAN.weaponSwapTime;
  unit.cooldownTimer = Math.max(unit.cooldownTimer, swapTime);
  return true;
}

export function footSpeed(unit: Unit): number {
  switch (unit.kind) {
    case 'commander':
      return COMMANDER.speed;
    case 'swordsman':
      return unit.faction === 'viking' ? VIKING.speed : unit.faction === 'bandit' ? BANDIT.speed : unit.faction === 'zombie' ? ZOMBIE.speed : SWORDSMAN.speed;
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

/** Two armies that made an alliance by crouching at each other. */
export function allied(state: MatchState, a: number, b: number): boolean {
  return state.alliances.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Armies on different teams fight, unless they are allied. */
export function armiesHostile(state: MatchState, a: number, b: number): boolean {
  if (a === b) return false;
  const teamA = state.armies[a]?.team ?? -1;
  const teamB = state.armies[b]?.team ?? -1;
  return teamA !== teamB && !allied(state, a, b);
}

export function areEnemies(state: MatchState, a: Unit, b: Unit): boolean {
  return armiesHostile(state, sideArmyId(state, a), sideArmyId(state, b));
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
