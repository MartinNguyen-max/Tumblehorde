import type { MapId } from './maps.ts';
import type { Vec2, Vec3 } from './math.ts';
import type { RandomSource } from './random.ts';

export type EntityId = number;

export type UnitKind = 'commander' | 'swordsman' | 'archer' | 'rider' | 'horse';
export type SoldierKind = 'swordsman' | 'archer' | 'rider';

export type Order = 'follow' | 'hold' | 'attack';
export type Weapon = 'sword' | 'spear' | 'bow';
export type GameMode = 'ffa' | 'teams';
export type ArmySize = 15 | 25 | 40;
/** How the player's army holds its ground: one long line, two lines, or a ring around the commander. */
export type Formation = 'line' | 'double' | 'circle' | 'wedge' | 'column' | 'square';
/** `legion` is swordsmen only. `mixed` (swordsmen, archers, cavalry) is parked for now but still works. */
export type ArmyMix = 'legion' | 'mixed';
/** The banquet: once per battle the army feasts around its commander and is drunk ever after. */
export type BanquetState = 'ready' | 'feasting' | 'drunk';

/** What a unit is doing with its weapon right now. */
export type ActionKind = 'none' | 'melee' | 'shoot';

/** The per-tick wishes of a unit, written by a player's input or by the AI. */
export interface Intent {
  /** Desired movement direction in world space, length 0..1. */
  moveX: number;
  moveZ: number;
  faceYaw: number;
  jump: boolean;
  attack: boolean;
  shield: boolean;
  /** Where a player aims their bow; bots aim at their target instead. */
  aim: Vec3 | null;
}

export interface AiMemory {
  targetId: EntityId | null;
  thinkTimer: number;
  shieldTimer: number;
  /** Rider charge point, so cavalry rides through its target instead of stopping. */
  chargePoint: Vec2 | null;
  horseTargetId: EntityId | null;
  /** The enemy this soldier keeps an eye on between thinks (nearest in sight). */
  watchId: EntityId | null;
  /** Cached route step: where to walk next on the way to `navGoal`, refreshed every `navTimer` seconds. */
  navGoal: Vec2 | null;
  navPoint: Vec2 | null;
  navTimer: number;
}

export interface Unit {
  id: EntityId;
  kind: UnitKind;
  armyId: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  onGround: boolean;
  stunTimer: number;
  action: ActionKind;
  /** Seconds left of the current windup or draw. */
  actionTimer: number;
  cooldownTimer: number;
  shieldUp: boolean;
  /** Set on riders/commanders while mounted. */
  mountId: EntityId | null;
  /** Set on horses while ridden. */
  riderId: EntityId | null;
  group: number;
  /** Only commanders can switch; soldiers carry the weapon of their kind. */
  weapon: Weapon;
  /** Seconds since this unit last took damage. */
  sinceHurt: number;
  /** Army that last damaged this unit, for kill credit. */
  lastHitByArmy: number | null;
  invulnerableTimer: number;
  respawnTimer: number;
  /** After the banquet: sways and stumbles, but hits hard and shrugs blows off. */
  drunk: boolean;
  /** Standing in water right now. */
  wet: boolean;
  intent: Intent;
  ai: AiMemory;
}

export interface GroupOrder {
  order: Order;
  /** Hold point and facing, captured when the order was given. */
  anchor: Vec2;
  anchorYaw: number;
  /** Hold formed around the commander rather than where the group stands. */
  aroundCommander: boolean;
  /** Shape of a hold. */
  formation: Formation;
}

export interface ArmyStats {
  kills: number;
  deaths: number;
  commanderDeaths: number;
}

export interface BotBrain {
  orderTimer: number;
  thinkTimer: number;
  /** Seconds spent facing the enemy without engaging. */
  standoffTimer: number;
}

export interface Army {
  id: number;
  team: number;
  name: string;
  isBot: boolean;
  /** Bot armies have no commander: they run themselves. */
  commanderId: EntityId | null;
  soldierIds: EntityId[];
  groupCount: number;
  groupOrders: GroupOrder[];
  /** The formation the next Hold uses. */
  formation: Formation;
  banquet: BanquetState;
  /** Where the army last saw an enemy (fog of war), shared by everyone in it. */
  intel: { x: number; z: number; time: number } | null;
  /** Where the army goes looking when it must attack but has not seen anyone. */
  searchPoint: Vec2 | null;
  searchTimer: number;
  /** Seconds of feasting left. */
  feastTimer: number;
  /** Seconds until the commander can give another rousing speech. */
  rallyTimer: number;
  eliminated: boolean;
  /** When the commander dies for good (forfeit), they never respawn. */
  forfeited: boolean;
  /** Seconds left before a disconnected army dies, or null if connected. */
  disconnectTimer: number | null;
  stats: ArmyStats;
  bot: BotBrain;
  startingSoldiers: number;
}

export interface Arrow {
  id: EntityId;
  armyId: number;
  shooterId: EntityId;
  damage: number;
  knockback: { strength: number; stun: number };
  pos: Vec3;
  vel: Vec3;
  age: number;
}

export interface ArmySetup {
  name: string;
  team: number;
  isBot: boolean;
}

export interface MatchSettings {
  mode: GameMode;
  armySize: ArmySize;
  armies: ArmySetup[];
  seed: number;
  map: MapId;
  /** Which unit types the armies have. Defaults to `legion`. */
  mix?: ArmyMix;
}

export type MatchPhase = 'playing' | 'ending' | 'over';

export type SimEvent =
  | {
      type: 'hit';
      targetId: EntityId;
      attackerId: EntityId;
      damage: number;
      blocked: boolean;
      knockback: Vec3;
    }
  | { type: 'death'; unitId: EntityId; killerArmyId: number | null; knockback: Vec3 }
  | { type: 'swing'; unitId: EntityId }
  | { type: 'arrowFired'; arrowId: EntityId; shooterId: EntityId }
  | { type: 'arrowLanded'; pos: Vec3; dir: Vec3 }
  | { type: 'respawn'; unitId: EntityId }
  | { type: 'mount'; riderId: EntityId; horseId: EntityId }
  | { type: 'dismount'; riderId: EntityId; horseId: EntityId; thrown: boolean }
  | { type: 'trample'; horseId: EntityId; targetId: EntityId }
  | { type: 'edgePush'; unitId: EntityId }
  | { type: 'order'; armyId: number; group: number | null; order: Order; formation: Formation }
  | { type: 'split'; armyId: number; groupCount: number }
  | { type: 'advance'; armyId: number; group: number | null }
  | { type: 'banquet'; armyId: number }
  | { type: 'drunk'; armyId: number }
  | { type: 'rally'; armyId: number; commanderId: EntityId }
  | { type: 'stumble'; unitId: EntityId }
  | { type: 'splash'; unitId: EntityId }
  | { type: 'armyEliminated'; armyId: number }
  | { type: 'matchOver'; winnerTeam: number | null };

export interface MatchState {
  settings: MatchSettings;
  time: number;
  tick: number;
  units: Unit[];
  armies: Army[];
  arrows: Arrow[];
  nextArrowId: EntityId;
  rng: RandomSource;
  phase: MatchPhase;
  endTimer: number;
  winnerTeam: number | null;
  /** Events produced during the latest step. Cleared at the start of every step. */
  events: SimEvent[];
}

/** One frame of input from the player controlling a commander. */
export interface CommanderInput {
  moveX: number;
  moveZ: number;
  faceYaw: number;
  jump: boolean;
  attack: boolean;
  shield: boolean;
  aim: Vec3 | null;
}

/** Discrete actions that are not part of the per-frame input. */
export type Command =
  | { type: 'order'; order: Order; group: number | null }
  | { type: 'split'; groupCount: number }
  /** Picks the formation and holds in it right away (one group, or the whole army when null). */
  | { type: 'formation'; formation: Formation; group?: number | null }
  | { type: 'mount' }
  | { type: 'weapon'; weapon: Weapon }
  | { type: 'banquet' }
  | { type: 'rally' }
  /** Holding formations step forward a few meters, towards where the commander looks. */
  | { type: 'advance'; group: number | null };
