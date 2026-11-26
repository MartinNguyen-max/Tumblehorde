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
  size: 220,
  halfSize: 110,
  /** Distance from the edge where the player starts seeing the warning. */
  edgeWarningDistance: 4,
  edgePushSpeed: 6,
  /** Hard limit past the edge, so nothing can ever escape. */
  edgeHardOvershoot: 1,
  /** Armies start on a circle of this radius, so two armies are 170 m apart (~35 s walk). */
  armySpawnRadius: 85,
  seed: 1337,
} as const;

export const TERRAIN = {
  /** Terrain extends past the playable map so the horizon is filled. */
  extent: 150,
  cellSize: 2.5,
  hillBlendDistance: 26,
  /** Rim hills outside the map that frame the battlefield. */
  rimStart: 115,
  rimSlope: 0.22,
} as const;

/** The castle moat: shallow water. Wading is slow, and soldiers who blunder in fall over. */
export const WATER = {
  depth: 1.1,
  /** Surface height, relative to the dry ground around it. */
  level: -0.4,
  wadeSpeedFactor: 0.55,
  /** Soldiers who end up in the water go down for this long... */
  fallStun: 1.8,
  /** ...with a little forward stumble. */
  fallPop: 1.5,
} as const;

export const OBSTACLES = {
  treeTrunkRadius: 0.4,
  cactusRadius: 0.45,
  rockRadius: 0.9,
  keepClearOfSpawn: 14,
  keepClearOfCenter: 14,
  keepClearOfMoat: 3,
} as const;

export const BODY = {
  personRadius: 0.42,
  personHeight: 1.9,
  horseRadius: 0.85,
  horseHeight: 1.6,
  /** Rider's feet sit this high above the horse's feet: a stocky horse, so riding only lifts you a little. */
  saddleHeight: 0.72,
  personMass: 1,
  horseMass: 4,
  /** How much of a crowd push a commander takes from enemies (own soldiers always make way). */
  commanderShoveShare: 0.3,
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
  /** The shove lands even on a raised shield (spear thrusts keep attackers off the line). */
  shovesThroughShield?: boolean;
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
  /** A knocked-out commander's body flies with this fraction of the killing blow's push. */
  downedSlideFactor: 0.5,
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
  /** Attack: the gladius comes out. */
  melee: {
    damage: 25,
    range: 2.0,
    cooldown: 1.1,
    windup: 0.3,
    arcHalfAngle: 55 * DEG,
    maxTargets: 1,
    knockback: SWORD_KNOCKBACK,
  } satisfies MeleeStats,
  /**
   * Follow and Hold: the spear, thrust over the shield. Longer reach and little damage, but a
   * big shove that lands even on a raised shield: a held spear line keeps attackers off it.
   */
  spear: {
    damage: 14,
    range: 2.7,
    cooldown: 1.1,
    windup: 0.3,
    arcHalfAngle: 35 * DEG,
    maxTargets: 1,
    knockback: { strength: 9, stun: 0.7 },
    shovesThroughShield: true,
  } satisfies MeleeStats,
  /** Time to swap spear and sword when the order changes. */
  weaponSwapTime: 0.5,
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
  /** A stocky war horse: quicker than a soldier, but not by much, so the army can keep up. */
  speed: 7.5,
  jumpHeight: 1.4,
  /** A horse moving faster than this tramples enemies it runs into. */
  trampleMinSpeed: 5,
  trample: { strength: 12, stun: 1.5 } satisfies KnockbackStats,
  trampleDamage: 10,
  /** A commander's charge breaks even a locked shield wall and leaves soldiers on the ground for a while. */
  commanderCharge: { strength: 10, stun: 2.8 } satisfies KnockbackStats,
  commanderChargeDamage: 15,
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
  /** Someone braced behind a raised shield weighs this much in a crowd: hard to push into. */
  bracedMass: 3,
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
  sizes: [15, 25, 40] as const,
  /** Soldiers per army for each mix. Archers and cavalry are parked for now (see `ArmyMix`). */
  mixes: {
    legion: {
      15: { swordsman: 15, archer: 0, rider: 0 },
      25: { swordsman: 25, archer: 0, rider: 0 },
      40: { swordsman: 40, archer: 0, rider: 0 },
    },
    mixed: {
      15: { swordsman: 9, archer: 4, rider: 2 },
      25: { swordsman: 15, archer: 7, rider: 3 },
      40: { swordsman: 24, archer: 11, rider: 5 },
    },
  },
  defaultMix: 'legion' as const,
  /** Bot armies have no commander: they run themselves. Players (online too) always lead their own. */
  botCommanders: false,
  maxArmies: 4,
  minArmies: 2,
  maxGroups: 3,
} as const;

export const FORMATION = {
  spacing: 1.5,
  rowWidth: 6,
  /** Distance behind the commander where the follow formation starts. */
  followDistance: 4,
  /** Following archers walk behind the swordsmen; riders ride on the flank. */
  followArcherDepth: 7,
  followRiderSide: 7,
  /** Hold around the commander for mixed armies: cavalry waits beside a front this wide, archers behind. */
  frontLineSize: 8,
  frontLineDistance: 2.6,
  archerRowsDistance: 4.5,
  cavalryFlankGap: 3,
  /** Holding swordsmen stand shoulder to shoulder (just over a body's width), shields touching. */
  tightSpacing: 0.86,
  rankGap: 1.0,
  /** Line formations stand this far ahead of the commander, so they stand right behind it. */
  holdLineAhead: 2.6,
  /** A wedge's ranks grow by this many soldiers from its tip backwards. */
  wedgeGrowth: 2,

  /** Advance moves a holding formation this far forward. */
  advanceStep: 4,
  /** The ring around the commander never gets smaller than this. */
  circleMinRadius: 2.4,
  defaultFormation: 'double' as const,
  /** Sideways offset between groups when several groups follow. */
  groupSideOffset: 9,
  /** A unit closer to its slot than this counts as arrived. */
  arriveRadius: 0.6,
  /** Holding soldiers settle much closer to their slot, so the ranks stay straight and tight. */
  holdArriveRadius: 0.15,
  /** Holding soldiers raise their shields once this close to their place. */
  shieldUpDistance: 1.2,
  commanderSpawnAhead: 5,
} as const;

/** Grid navigation for AI soldiers on maps with buildings. */
export const NAV = {
  cellSize: 1.5,
  /** Extra room kept from walls, on top of a body's radius. */
  clearance: 0.3,
  /** How far (in cells) to look for a free spot when a formation place falls inside a building. */
  searchRadius: 10,
  /** Flow fields built per simulation step at most; more wait for the next step. */
  fieldsPerStep: 5,
  cachedFields: 192,
  /** Goals further away than this share fields: they snap to a lattice every `coarseCells` cells. */
  coarseGoalDistance: 14,
  coarseCells: 4,
  /** Cells to look ahead along the flow, so paths cut corners smoothly. */
  lookahead: 8,
  /** Cells searched for a way out of water or an alley. */
  escapeSearch: 800,
  /** Only cells this deep inside a wall count as solid, so even the narrowest alley stays open. */
  solidInset: 0.6,
  /** Sight lines are checked against the walls every this many meters. */
  sightStep: 0.4,
  /** A soldier re-plans its next step this often, or when its goal moves this far. */
  replanInterval: 0.25,
  replanGoalShift: 1.5,
} as const;

/** Fog of war in the city: soldiers only know about enemies someone in the army has seen. */
export const PERCEPTION = {
  sightRange: 60,
  /** Line-of-sight checks per look, nearest enemies first. */
  maxSightChecks: 4,
  /** A sighting is forgotten after this long... */
  intelMemory: 25,
  /** ...or once the army reaches the spot and finds nobody. */
  intelClearRadius: 6,
  /** Searching soldiers pick a new street corner this often, or on arriving. */
  searchRetarget: 25,
  searchArriveRadius: 8,
  searchMinDistance: 20,
  /** The commander looks around every this many steps. */
  commanderLookEvery: 6,
} as const;

/**
 * The pincer: a third of the army on each wing, the rest a shield line in the middle. With an
 * enemy near, the wings swing round its flanks and close in on its back.
 */
export const PINCER = {
  /** Without an enemy near, the wings wait this far ahead of the line, on its ends... */
  wingAhead: 4,
  /** ...this far out from it. */
  wingGap: 3,
  /** The wings go after enemies this close to where the pincer was ordered. */
  range: 45,
  /** Going round, a wing passes this far outside the enemy's flank... */
  sideGap: 5,
  /** ...then closes in this far behind the enemy's line. */
  behindDepth: 6,
  /** The flank point lies this share of `behindDepth` past the enemy's line. */
  flankPast: 0.7,
  /** In the city's fog only the sighting is known: assume a line this wide either side. */
  assumedHalfWidth: 6,
} as const;

export const AI = {
  thinkInterval: 0.2,
  reactionRadius: 25,
  /** Units on Follow give up a chase this far from their slot. */
  followLeash: 22,
  holdEngageRadius: 6,
  shieldReactRadius: 3.5,
  shieldMinHold: 0.6,
  /** Medium bots do not see every blow coming: the chance a soldier raises the shield against one. */
  shieldReactChance: 0.6,
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
  /** At each think a soldier picks the nearest enemy in sight within this distance to keep an eye on. */
  watchRadius: 45,
  /** Swordsmen on Hold lock shields when an enemy is this close. */
  shieldWallRadius: 30,
  /** Mounted riders on Attack go for enemy archers within this distance first. */
  riderFlankRadius: 45,
  riderOvershoot: 6,
  /** Archers this close to an enemy back off even while ready to shoot. */
  archerPanicDistance: 8,
  /** Soldiers walking to their place give their own commander this much room... */
  leaderClearance: 0.3,
  /** ...by veering sideways this strongly. */
  leaderSidestep: 1.5,
  /** A soldier holding a formation only turns to enemies within this angle of its slot's facing. */
  holdFacingArc: 85 * DEG,
  /** A soldier this far from its slot looks where it walks instead of the formation's way. */
  faceWalkingDistance: 3,
} as const;

export const BOT = {
  orderInterval: 5,
  thinkInterval: 0.25,
  /** Beyond this distance between army centers the bot marches as one block. */
  marchDistance: 32,
  /** Between this and marchDistance the bot holds a spear wall and waits for the enemy to come. */
  engageDistance: 14,
  /** How long a bot waits in a standoff before it charges anyway. */
  standoffPatience: 12,
  /** After falling back this long, a beaten bot army makes its last stand and attacks again. */
  maxRegroup: 25,
  /** A bot army that knows where the enemy is but has not been hurt for this long goes and gets them. */
  stalemateTime: 40,
  /** A castle's bot defenders sally out once they outnumber every attacker together this much. */
  sallyRatio: 2,
  /** Phalanx bots step their formation forward this far at a time... */
  phalanxStep: 3,
  /** ...until their middle is this close to the enemy's: then they hold and thrust... */
  phalanxContact: 4,
  /** ...and if the enemy line still stands after this long, they draw swords and go in. */
  phalanxGrind: 15,
  /** Patient bots only leave their shield wall when the enemy is this close... */
  patientEngageDistance: 9,
  /** ...or after waiting this long. */
  patientMaxWait: 50,
  /** A bot army without a commander marches by holding a spot this far ahead... */
  advanceStep: 10,
  /** ...and moving it on this often, so the formation keeps walking. */
  advanceInterval: 1.5,
  /** Fewer soldiers than this fraction of the enemy's makes the bot fall back and regroup. */
  regroupRatio: 0.5,
  /** The bot commander stays this far behind its own front line. */
  commanderBehindLine: 8,
  /** A marching bot commander stops leading this far from the enemy: inside marchDistance, so the army then forms up. */
  marchStopDistance: 22,
  retreatHpFraction: 0.3,
  /** A wounded bot commander backs off from enemies this close... */
  retreatTriggerDistance: 9,
  /** ...by this much. */
  retreatDistance: 8,
  /** Bot commanders fight anyone this close, whatever their army's order. */
  selfDefenseDistance: 12,
} as const;

/** The banquet: soldiers gather round, drink, and stay very drunk for the rest of the battle. */
export const BANQUET = {
  feastTime: 6,
  /** The feasting ring stands this much wider than a circle formation. */
  gatherExtraRadius: 1.2,
  damageTakenFactor: 0.55,
  damageDealtFactor: 1.3,
  knockbackTakenFactor: 0.4,
  /** Drunk blows shove much harder, and locked shield walls do not hold against them. */
  strikeKnockbackFactor: 1.8,
  cooldownFactor: 0.75,
  /** Heavier in the crowd: drunks barge through formations. */
  mass: 2.5,
  /** Walking direction wobbles by up to this angle (radians)... */
  swayAngle: 0.75,
  swaySpeed: 2.3,
  /** ...and standing still they drift around their place like this (fraction of full speed). */
  idleDrift: 0.35,
  /** Running drunks trip at this rate (chance per second)... */
  tripPerSecond: 0.1,
  tripMinSpeed: 3,
  /** ...and lie there for this long. */
  tripStun: 1.6,
  tripPop: 2.5,
} as const;

/** The commander's rousing speech: only for show, so it just needs a pause between speeches. */
export const RALLY = {
  cooldown: 6,
} as const;

/** Alliances: crouch a few times at another commander; if they crouch back up close, you are allies. */
export const ALLIANCE = {
  tapsNeeded: 4,
  tapWindow: 3.5,
  /** The two commanders must be this close... */
  range: 16,
  /** ...and look at each other within this angle. */
  lookAngle: 30 * DEG,
  /** An offer waits this long for the crouch back. */
  offerTime: 10,
} as const;

/** Crouching walks slowly. */
export const CROUCH = {
  speedFactor: 0.45,
} as const;

/** The one spear volley of a battle: pila thrown at enemies around where the commander looks. */
export const VOLLEY = {
  range: 30,
  /** Enemies this close to the aimed spot are the targets. */
  targetRadius: 9,
  speed: 22,
  damage: 50,
  knockback: { strength: 7, stun: 1 } satisfies KnockbackStats,
  /** A pilum punches through a raised shield: this share of its damage still lands. */
  shieldPierce: 0.6,
  windup: 0.45,
  /** Soldiers throw one after another within this many seconds. */
  maxDelay: 0.6,
} as const;

export const MATCH = {
  /** Armies form up this long before bots start to march. */
  prepareTime: 20,
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

/** Every weapon in the game, in network order. */
export const WEAPONS = ['sword', 'spear', 'bow'] as const;
/** What a commander carries. The bow is parked along with archers for now. */
export const COMMANDER_WEAPONS = ['sword', 'spear'] as const;
export const FORMATIONS = ['line', 'double', 'circle', 'wedge', 'pincer', 'square'] as const;
