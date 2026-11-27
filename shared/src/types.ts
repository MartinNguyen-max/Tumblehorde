import type { FighterKit } from './campaign/arena.ts';
import type { MapId } from './maps.ts';
import type { Vec2, Vec3 } from './math.ts';
import type { RandomSource } from './random.ts';

export type EntityId = number;

export type UnitKind = 'commander' | 'swordsman' | 'archer' | 'rider' | 'horse';
export type SoldierKind = 'swordsman' | 'archer' | 'rider';

export type Order = 'follow' | 'hold' | 'attack';
/** Romans and Vikings: the same bodies, different looks, weapons, shields and formations. */
export type Faction = 'roman' | 'viking' | 'bandit' | 'zombie';

export type Weapon = 'sword' | 'spear' | 'bow' | 'axe' | 'claw';
export type GameMode = 'ffa' | 'teams';
export type ArmySize = 15 | 25 | 40;
/** How the player's army holds its ground: one long line, two lines, or a ring around the commander. */
export type Formation = 'line' | 'double' | 'circle' | 'wedge' | 'pincer' | 'square' | 'boar' | 'swarm';
/** `legion` is swordsmen only. `mixed` (swordsmen, archers, cavalry) is parked for now but still works. */
export type ArmyMix = 'legion' | 'mixed';
/** The banquet: once per battle the army feasts around its commander and is drunk ever after. */
export type BanquetState = 'ready' | 'feasting' | 'drunk';

/** What a unit is doing with its weapon right now. */
export type ActionKind = 'none' | 'melee' | 'shoot' | 'throw';

/** The per-tick wishes of a unit, written by a player's input or by the AI. */
export interface Intent {
  /** Desired movement direction in world space, length 0..1. */
  moveX: number;
  moveZ: number;
  faceYaw: number;
  jump: boolean;
  attack: boolean;
  shield: boolean;
  /** Ducking down. Tapped a few times at another commander, it offers an alliance. */
  crouch: boolean;
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
  /** What a thrown spear is aimed at: an enemy, or a spot on the ground. */
  throwTargetId: EntityId | null;
  throwAt: Vec3 | null;
  /** Whoever hurt this soldier last, and when: they get paid back, whatever the order. */
  revengeId: EntityId | null;
  revengeTime: number;
  /** Which way this soldier circles an enemy between blows (+1 or -1), and when it next changes its mind. */
  circleSign: number;
  circleTimer: number;
  /** A quick hop out of the way of a blow: seconds left and the direction. */
  dodgeTimer: number;
  dodgeX: number;
  dodgeZ: number;
  /** The next blow is a shield bash, and the blow under way is one. */
  bashNext: boolean;
  bashing: boolean;
}

export interface Unit {
  id: EntityId;
  kind: UnitKind;
  armyId: number;
  faction: Faction;
  /** A named hero of the story: knocked down, they get back up instead of dying. */
  hero: string | null;
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
  /** Standing on ice right now: it slides. */
  onIce: boolean;
  crouching: boolean;
  /** This soldier has thrown its spear and fights on with the sword. */
  spearThrown: boolean;
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
  /** A pincer's wings, chosen once when it forms, so soldiers never swap sides mid-fight. */
  pincer?: { left: EntityId[]; right: EntityId[] };
}

export interface ArmyStats {
  kills: number;
  deaths: number;
  commanderDeaths: number;
}

/**
 * How a bot army likes to fight, picked at random each battle (and again after it regroups):
 * - steady: form up, stand off behind a spear wall, then charge with swords;
 * - charge: no waiting, straight at you with swords;
 * - phalanx: push forward in formation with spears and never break ranks;
 * - patient: wait behind a shield wall for you to come, and only then fight;
 * - flank: hold a pincer, send the wings round behind the enemy, then charge.
 */
export type BotStyle = 'steady' | 'charge' | 'phalanx' | 'patient' | 'flank';

export interface BotBrain {
  style: BotStyle;
  /** Seconds a phalanx has stood at the enemy's line. */
  contactTimer: number;
  /** Seconds flankers have held their pincer near the enemy. */
  flankTimer: number;
  /** Seconds spent falling back to regroup; after a while the army makes a last stand instead. */
  regroupTimer: number;
  /** Falling back right now (a new style is picked when a fall-back starts). */
  regrouping: boolean;
  orderTimer: number;
  thinkTimer: number;
  /** Seconds spent facing the enemy without engaging. */
  standoffTimer: number;
  /** Recent harm done to this army, per attacking army id; fades over time. Bots turn on whoever hurts them most. */
  threat: number[];
}

export interface Army {
  id: number;
  team: number;
  name: string;
  isBot: boolean;
  faction: Faction;
  /** Story battles: cloth color and named people's looks (see `ArmySetup`). */
  color: string | null;
  looks: Readonly<Record<string, string>>;
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
  /** Seconds of courage left after a speech: harder blows, steadier feet. */
  courageTimer: number;
  /** Recent crouch taps by the commander, for offering alliances. */
  gesture: { taps: number[]; wasCrouching: boolean };
  /** An alliance this army offered, waiting for an answer. */
  allyOffer: { to: number; time: number } | null;
  /** The one spear volley of the battle has been thrown. */
  spearsThrown: boolean;
  eliminated: boolean;
  /** When the commander dies for good (forfeit), they never respawn. */
  forfeited: boolean;
  /** Seconds left before a disconnected army dies, or null if connected. */
  disconnectTimer: number | null;
  /** Seconds until the next reinforcements arrive (only for armies that get them). */
  reinforceTimer: number;
  stats: ArmyStats;
  bot: BotBrain;
  startingSoldiers: number;
}

export type ProjectileKind = 'arrow' | 'pilum' | 'axe';

export type RefusedReason = 'spearsSpent' | 'noTargetInRange' | 'banquetSpent' | 'notHolding' | 'enemyAhead' | 'rallyResting';

export interface Arrow {
  id: EntityId;
  kind: ProjectileKind;
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
  /** On the castle map: this army holds the castle. Without it, team 0 (or in free-for-all the first army) does. */
  defends?: boolean;
  /** Romans unless said otherwise. */
  faction?: Faction;
  /** Story battles: exactly this many soldiers, instead of the battle's army size. */
  soldiers?: number;
  /** Story battles: where the army starts, instead of the map's usual spawn. */
  spawn?: { x: number; z: number; yaw: number };
  /** A bot army led by a commander of its own (an ally's general, an enemy warlord). */
  commander?: boolean;
  /** Story battles: the first soldiers are these named heroes, who get back up when knocked down. */
  heroes?: readonly string[];
  /** A bot army that waits where it stands until this many seconds into the battle. */
  arriveAt?: number;
  /** Fresh soldiers keep joining at the spawn: `count` every `every` seconds, without end. */
  reinforce?: { every: number; count: number };
  /** The commander's hit points, times this (a warlord is hard to bring down). */
  commanderToughness?: number;
  /** The bot's fighting style, instead of a random one. */
  style?: BotStyle;
  /** Story battles: the commander starts without a horse (before he has one, or after the riders dismounted). */
  onFoot?: boolean;
  /** Story battles: each soldier's hit points, times this (veterans are tougher); missing means 1. */
  toughness?: readonly number[];
  /** Story battles: the army's cloth color (the legion's red), instead of the team's. */
  color?: string;
  /**
   * Story battles: how named people look, so battles match the scenes around them. Keys are hero
   * names, and `commander` for the army's commander; values name a look in the client's cast.
   */
  looks?: Readonly<Record<string, string>>;
  /** Campaign: hit points of every fighter in the army, and multipliers on their damage and shield. */
  kit?: FighterKit;
}

export interface MatchSettings {
  mode: GameMode;
  armySize: ArmySize;
  armies: ArmySetup[];
  seed: number;
  map: MapId;
  /** Campaign arena: commanders fight on foot and do not get back up when they go down. */
  arena?: boolean;
  /** Which unit types the armies have. Defaults to `legion`. */
  mix?: ArmyMix;
  /** Seconds bots spend forming up before they march (story battles can start sooner). */
  prepareTime?: number;
  /** The campaign keeps the army whole: no splitting it in two. */
  noSplit?: boolean;
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
  /** A blow starts; `bash` is a shove with the shield instead of a weapon strike. */
  | { type: 'swing'; unitId: EntityId; bash?: boolean }
  | { type: 'arrowFired'; arrowId: EntityId; shooterId: EntityId }
  | { type: 'arrowLanded'; pos: Vec3; dir: Vec3; kind: ProjectileKind }
  /** A thrown spear stuck in a unit (or its shield): it goes where they go. */
  | { type: 'pilumStuck'; targetId: EntityId; pos: Vec3; dir: Vec3; kind: ProjectileKind }
  | { type: 'respawn'; unitId: EntityId }
  | { type: 'mount'; riderId: EntityId; horseId: EntityId }
  | { type: 'dismount'; riderId: EntityId; horseId: EntityId; thrown: boolean }
  | { type: 'trample'; horseId: EntityId; targetId: EntityId }
  | { type: 'edgePush'; unitId: EntityId }
  | { type: 'order'; armyId: number; group: number | null; order: Order; formation: Formation }
  | { type: 'split'; armyId: number; groupCount: number }
  | { type: 'advance'; armyId: number; group: number | null }
  | { type: 'allyOffer'; from: number; to: number }
  | { type: 'alliance'; a: number; b: number }
  | { type: 'volley'; armyId: number }
  /** An order that could not be carried out, so the player can be told why. */
  | { type: 'refused'; armyId: number; reason: RefusedReason }
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
  /** Pairs of army ids that made an alliance: they cannot hurt each other. */
  alliances: [number, number][];
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
  crouch: boolean;
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
  | { type: 'advance'; group: number | null }
  /** Once per battle: the soldiers throw their spears at enemies around `at`. */
  | { type: 'volley'; at: Vec3; group: number | null };
