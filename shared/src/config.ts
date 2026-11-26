// All gameplay numbers live here. See docs/BALANCE.md for the source of the values.
// Units: meters, seconds, HP, radians.

const DEG = Math.PI / 180;

export const SIM = {
  /** Fixed step used for local (in-browser) battles. */
  localTickRate: 60,
  /** Fixed step used by the authoritative server. A snapshot is sent every tick. */
  serverTickRate: 20,
  gravity: 25,
  groundAccel: 40,
  airAccel: 8,
  /** Deceleration of sliding (stunned) bodies on the ground. */
  groundFriction: 12,
  /** Feet snap back to the ground when walking downhill within this distance. */
  groundSnap: 0.35,
  maxDeltaTime: 0.1,
} as const;

export const MOVEMENT = {
  /** Movement speed factor while winding up a strike or drawing a bow. */
  attackingSpeedFactor: 0.5,
  /** A turning horse never slows below this fraction of its speed. */
  horseMinTurnSpeedFactor: 0.3,
  /** A follow formation turns with the commander only while they move faster than this. */
  followTurnMinSpeed: 1.5,
  followTurnRate: 2.5,
} as const;

export const MAP = {
  size: 150,
  halfSize: 75,
  /** Distance from the edge where the player starts seeing the warning. */
  edgeWarningDistance: 4,
  edgePushSpeed: 6,
  /** Hard limit past the edge, so nothing can ever escape. */
  edgeHardOvershoot: 1,
  /** Armies start on a circle of this radius, so two armies are 110 m apart (~20 s walk). */
  armySpawnRadius: 55,
  seed: 1337,
} as const;

export const TERRAIN = {
  /** Terrain extends past the playable map so the horizon is filled. */
  extent: 110,
  cellSize: 2.5,
  hillBlendDistance: 26,
  /** Rim hills outside the map that frame the battlefield. */
  rimStart: 80,
  rimSlope: 0.22,
} as const;

export const OBSTACLES = {
  treeTrunkRadius: 0.4,
  cactusRadius: 0.45,
  rockRadius: 0.9,
  keepClearOfSpawn: 14,
  keepClearOfCenter: 14,
} as const;

export const BODY = {
  personRadius: 0.42,
  personHeight: 1.9,
  horseRadius: 0.85,
  horseHeight: 2.3,
  /** Rider's feet sit this high above the horse's feet. */
  saddleHeight: 1.35,
  personMass: 1,
  horseMass: 4,
  personTurnRate: 14,
  horseTurnRate: 3.2,
  horseAccel: 14,
} as const;

export interface KnockbackStats {
  /** Horizontal speed given to the target, m/s. */
  strength: number;
  stun: number;
}

export interface MeleeStats {
  damage: number;
  range: number;
  cooldown: number;
  /** Time from starting the swing to the hit being resolved. */
  windup: number;
  /** Half-angle of the strike cone in front of the attacker. */
  arcHalfAngle: number;
  maxTargets: number;
  knockback: KnockbackStats;
}

export interface RangedStats {
  damage: number;
  range: number;
  cooldown: number;
  /** Bow draw time before the arrow is released. */
  drawTime: number;
  knockback: KnockbackStats;
}

const SWORD_KNOCKBACK: KnockbackStats = { strength: 3, stun: 0.4 };
const MOUNTED_SPEAR_KNOCKBACK: KnockbackStats = { strength: 9, stun: 1.2 };

export const COMMANDER = {
  hp: 300,
  speed: 6,
  jumpHeight: 1.2,
  respawnTime: 15,
  /** Brief invulnerability after getting back up, so you are not knocked out again at once. */
  respawnShield: 3,
  /** Getting back up shoves nearby enemies away. */
  respawnShove: { radius: 5, strength: 8, stun: 1 } satisfies KnockbackStats & { radius: number },
  /** Out of combat the commander patches themselves up. */
  regenDelay: 5,
  regenPerSecond: 6,
  /** Time it takes to switch weapons. */
  weaponSwapTime: 0.3,
  melee: {
    damage: 35,
    range: 2.2,
    cooldown: 0.6,
    windup: 0.2,
    arcHalfAngle: 65 * DEG,
    maxTargets: 2,
    knockback: SWORD_KNOCKBACK,
  } satisfies MeleeStats,
  mountedMelee: {
    damage: 35,
    range: 3.0,
    cooldown: 0.6,
    windup: 0.2,
    arcHalfAngle: 70 * DEG,
    maxTargets: 2,
    knockback: { strength: 7, stun: 0.9 },
  } satisfies MeleeStats,
  spear: {
    damage: 30,
    range: 2.8,
    cooldown: 0.8,
    windup: 0.25,
    arcHalfAngle: 40 * DEG,
    maxTargets: 2,
    knockback: { strength: 5, stun: 0.6 },
  } satisfies MeleeStats,
  mountedSpear: {
    damage: 45,
    range: 3.4,
    cooldown: 1.0,
    windup: 0.15,
    arcHalfAngle: 45 * DEG,
    maxTargets: 2,
    knockback: MOUNTED_SPEAR_KNOCKBACK,
  } satisfies MeleeStats,
  bow: {
    damage: 35,
    range: 45,
    cooldown: 1.0,
    drawTime: 0.45,
    knockback: { strength: 2, stun: 0.2 },
  } satisfies RangedStats,
} as const;

export const SWORDSMAN = {
  hp: 180,
  speed: 5,
  melee: {
    damage: 25,
    range: 2.0,
    cooldown: 1.1,
    windup: 0.3,
    arcHalfAngle: 55 * DEG,
    maxTargets: 1,
    knockback: SWORD_KNOCKBACK,
  } satisfies MeleeStats,
} as const;

export const ARCHER = {
  hp: 120,
  speed: 5,
  ranged: {
    damage: 30,
    range: 35,
    cooldown: 2.5,
    drawTime: 0.55,
    knockback: { strength: 2, stun: 0.2 },
  } satisfies RangedStats,
  /** Archers are weak in melee: same damage, but the range drops to 2.0 m. */
  melee: {
    damage: 30,
    range: 2.0,
    cooldown: 2.0,
    windup: 0.35,
    arcHalfAngle: 50 * DEG,
    maxTargets: 1,
    knockback: SWORD_KNOCKBACK,
  } satisfies MeleeStats,
} as const;

export const RIDER = {
  hp: 180,
  /** Speed on foot after the horse is lost. */
  speed: 5,
  mountedMelee: {
    damage: 40,
    range: 3.2,
    cooldown: 1.3,
    windup: 0.15,
    arcHalfAngle: 60 * DEG,
    maxTargets: 1,
    knockback: MOUNTED_SPEAR_KNOCKBACK,
  } satisfies MeleeStats,
  melee: {
    damage: 30,
    range: 2.4,
    cooldown: 1.0,
    windup: 0.3,
    arcHalfAngle: 50 * DEG,
    maxTargets: 1,
    knockback: SWORD_KNOCKBACK,
  } satisfies MeleeStats,
} as const;

export const HORSE = {
  hp: 280,
  speed: 11,
  /** A horse moving faster than this tramples enemies it runs into. */
  trampleMinSpeed: 6,
  trample: { strength: 12, stun: 1.5 } satisfies KnockbackStats,
  trampleDamage: 10,
  /** Mounted targets: chance that a hit lands on the horse instead of the rider. */
  hitsHorseChance: 0.5,
  /** Horses are heavy; swords barely shove them. */
  knockbackTaken: 0.25,
  mountRange: 3,
  /** Stun when thrown off a dying horse. */
  fallStun: 1.5,
  fallThrowSpeed: 5,
} as const;

export const SHIELD = {
  blockFraction: 0.92,
  /** Half-angle of the protected cone in front of the shield bearer. */
  frontHalfAngle: 75 * DEG,
  speedFactor: 0.6,
  /** Knockback is reduced on a blocked hit, and a blocked hit never stuns. */
  blockedKnockbackFactor: 0.3,
  /** Roman shield wall: a raised shield next to another raised shield blocks even more and does not budge. */
  wallBlockFraction: 0.97,
  wallNeighborDistance: 1.8,
} as const;

export const MELEE = {
  /** Height difference within which a strike can land (rider vs. foot soldier fits). */
  verticalReach: 2.5,
} as const;

export const KNOCKBACK = {
  /** Upward pop as a fraction of horizontal strength. It is what makes hits goofy. */
  lift: 0.35,
  /** Extra shove applied to a body on the killing blow. */
  deathBoost: 1.6,
} as const;

export const ARROW = {
  speed: 32,
  gravity: 14,
  maxLifetime: 4,
  /** Collision radius added to the target's body radius. */
  radius: 0.08,
  /** Launch angle when an arrow is fired without a target. */
  blindPitch: Math.PI / 8,
} as const;

export const ARMY = {
  sizes: [10, 20, 30] as const,
  composition: {
    10: { swordsman: 6, archer: 3, rider: 1 },
    20: { swordsman: 12, archer: 6, rider: 2 },
    30: { swordsman: 18, archer: 9, rider: 3 },
  },
  maxArmies: 4,
  minArmies: 2,
  maxGroups: 3,
} as const;

export const FORMATION = {
  spacing: 1.5,
  rowWidth: 6,
  /** Distance behind the commander where the follow formation starts. */
  followDistance: 4,
  /** Swordsmen holding a shield wall stand shoulder to shoulder in long ranks. */
  shieldWallSpacing: 1.15,
  shieldWallRowWidth: 8,
  /** Following archers walk behind the swordsmen; riders ride on the flank. */
  followArcherDepth: 7,
  followRiderSide: 7,
  /** Sideways offset between groups when several groups follow. */
  groupSideOffset: 9,
  /** A unit closer to its slot than this counts as arrived. */
  arriveRadius: 0.6,
  commanderSpawnAhead: 5,
} as const;

export const AI = {
  thinkInterval: 0.2,
  reactionRadius: 25,
  /** Units on Follow give up a chase this far from their slot. */
  followLeash: 22,
  holdEngageRadius: 6,
  shieldReactRadius: 3.5,
  shieldMinHold: 0.6,
  /** Units on Hold raise shields towards enemy archers within this distance. */
  shieldWallArcherRadius: 40,
  archerMinDistance: 15,
  /** Archers close in to this fraction of their range before shooting. */
  archerPreferredRangeFactor: 0.85,
  meleeApproachFactor: 0.8,
  aimYawSpread: 0.03,
  aimPitchSpread: 0.025,
  aimLeadIterations: 2,
  remountSearchRadius: 18,
  /** Idle soldiers turn to look at enemies this close. */
  lookAtEnemyRadius: 45,
  /** Swordsmen on Hold lock shields when an enemy is this close. */
  shieldWallRadius: 30,
  /** Mounted riders on Attack go for enemy archers within this distance first. */
  riderFlankRadius: 45,
  riderOvershoot: 6,
  /** Archers this close to an enemy back off even while ready to shoot. */
  archerPanicDistance: 8,
  /** A soldier this far from its slot looks where it walks instead of the formation's way. */
  faceWalkingDistance: 3,
} as const;

export const BOT = {
  orderInterval: 5,
  thinkInterval: 0.25,
  /** Beyond this distance between army centers the bot marches as one block. */
  marchDistance: 70,
  /** Between this and marchDistance the bot holds a shield wall and lets its archers work. */
  engageDistance: 38,
  /** How long a bot waits in a standoff before it charges anyway. */
  standoffPatience: 10,
  /** Fewer soldiers than this fraction of the enemy's makes the bot fall back and regroup. */
  regroupRatio: 0.5,
  /** The bot commander stays this far behind its own front line. */
  commanderBehindLine: 8,
  marchStopDistance: 45,
  /** The bot commander shoots enemies between these distances and draws the sword when closer. */
  bowMinDistance: 10,
  retreatHpFraction: 0.3,
  /** A wounded bot commander backs off from enemies this close... */
  retreatTriggerDistance: 9,
  /** ...by this much. */
  retreatDistance: 8,
  /** Bot commanders fight anyone this close, whatever their army's order. */
  selfDefenseDistance: 12,
} as const;

export const MATCH = {
  /** Armies form up this long before bots start to march. */
  prepareTime: 15,
  disconnectTimeout: 30,
  /** Bodies of a forfeited army pop up with this much random velocity. */
  forfeitPopSideways: 2,
  forfeitPopUpMin: 3,
  forfeitPopUpMax: 6,
  /** Seconds after victory before the battle is marked as finished. */
  endDelay: 2.5,
} as const;

export const NET = {
  maxPlayers: 4,
  minPlayers: 2,
  roomCodeLength: 5,
  maxNameLength: 16,
  inputRate: 20,
  /** Remote units are drawn this far in the past so there are always two snapshots to blend. */
  interpolationDelay: 0.1,
  /** Inputs queued on the server beyond this are dropped so lag cannot pile up. */
  maxQueuedInputs: 4,
  port: 2567,
} as const;

export const WEAPONS = ['sword', 'spear', 'bow'] as const;
