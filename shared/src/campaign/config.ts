// Campaign numbers. Units: seconds, meters, gold.

export const CAMPAIGN = {
  /** Bumped when the save shape changes in a way old saves cannot be read. */
  saveVersion: 1,
  legionSize: 25,
  /** The fortress tops the legion up to this many men before the last battle. */
  fortressMinimumLegion: 10,
  /** The first chapter where the fallen stay dead. */
  permadeathFromChapter: 'dark-forest',
  maxWorkouts: 3,
  strengthPerWorkout: 1,
  prices: { armor: 25, shield: 20, sword: 20 },
} as const;

export const CUTSCENE = {
  /** Seconds Space must be held to skip the current beat. */
  skipHoldTime: 0.6,
  /** A line of subtitle stays at least this long. */
  minLineTime: 1.6,
  /** Reading speed for subtitles, in characters per second; long lines stay longer. */
  readingSpeed: 15,
} as const;

export const NPC = {
  walkSpeed: 1.4,
  childSpeed: 2.1,
  fleeSpeed: 4.2,
  /** Seconds standing still between strolls. */
  idleMin: 2,
  idleMax: 6,
  /** How far from home an NPC strolls. */
  wanderRadius: 7,
  arriveDistance: 0.4,
  /** Seconds a punched NPC lies on the ground. */
  knockoutTime: 4,
  /** Seconds a frightened NPC runs before calming down. */
  fleeTime: 3,
  /** Those within this distance of a knockout run away from it. */
  fleeRadius: 6,
  /** How close the player must stand to talk (E) or punch. */
  talkDistance: 2.2,
  punchDistance: 1.4,
  /** The player talks to or punches someone within this angle (radians, either side) of where they face. */
  facingHalfAngle: 1.2,
} as const;
