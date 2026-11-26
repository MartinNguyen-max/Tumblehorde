// Visual-only constants for the client. Gameplay numbers live in shared/src/config.ts.
import type { MapId } from '@tumblehorde/shared';

export const COLORS = {
  sky: '#8EC9EE',
  fog: '#9ED3F0',
  accent: '#F08A24',
  skin: '#F2C29B',
  gold: '#E8C14A',
  eyeWhite: '#FFFFFF',
  pupil: '#1B1B24',
  boot: '#3A2E25',
  emblem: '#F2C94C',
  star: '#FFD84D',
  toast: '#FFD166',
  wood: '#8A5A32',
  darkWood: '#6E4A26',
  steel: '#CFD6DC',
  trunk: '#7A4A28',
  leaves: '#44933C',
  leavesTop: '#59B04A',
  rock: '#A8ADA6',
  bush: '#4E9E42',
  horseLight: '#6B4A32',
  horseDark: '#4A3A30',
  mane: '#2E2117',
  edgeWall: '#FFD166',
  bubble: '#E9D8FF',
  water: '#3E8FC4',
  splash: '#CFEFFF',
  shout: '#FFF1B8',
  edgePost: '#E8E2CF',
} as const;

/** Materials of the Roman soldiers. Team colors come from the army palette. */
export const ROMAN = {
  skin: '#E2AD86',
  skinShade: '#D39A72',
  brow: '#3B2A20',
  mouth: '#7A3B2E',
  steel: '#A3ACB6',
  armorDark: '#4D545D',
  iron: '#7A828A',
  brass: '#CFA64E',
  bronze: '#C98E3E',
  bronzeDark: '#8F5F25',
  leather: '#6E4528',
  darkLeather: '#45291A',
  wood: '#8A5A32',
  scabbard: '#5B2620',
  drool: '#BFE6FF',
  mouthInside: '#5A1E1A',
  drunkNose: '#E0544A',
  blush: '#F08A8A',
  wine: '#6E1630',
  terracotta: '#C2693D',
} as const;

export interface ArmyPalette {
  body: string;
  trim: string;
  name: string;
}

/** Free-for-all colors, in army order. */
export const FFA_PALETTES: readonly ArmyPalette[] = [
  { body: '#3C7BD0', trim: '#2A5A9C', name: 'Blue' },
  { body: '#D1483F', trim: '#9C332C', name: 'Red' },
  { body: '#E3B52B', trim: '#A88214', name: 'Gold' },
  { body: '#8E5BD0', trim: '#6440A0', name: 'Purple' },
];

/** Team mode: allies share a color family so sides are obvious at a glance. */
export const TEAM_PALETTES: readonly (readonly ArmyPalette[])[] = [
  [
    { body: '#3C7BD0', trim: '#2A5A9C', name: 'Blue' },
    { body: '#2FA4B9', trim: '#1F7685', name: 'Teal' },
  ],
  [
    { body: '#D1483F', trim: '#9C332C', name: 'Red' },
    { body: '#E07A2E', trim: '#A8561C', name: 'Orange' },
  ],
];

export interface HslRange {
  hue: number;
  saturation: number;
  lightMin: number;
  lightMax: number;
}

export interface MapTheme {
  sky: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  ground: HslRange;
  path: HslRange;
  /** High or steep ground turns into this. Null keeps the ground color. */
  rock: HslRange | null;
  /** Height above which ground counts as rock. */
  rockHeight: number;
  treeTrunk: string;
  leaves: string;
  leavesTop: string;
  rockColor: string;
  cactus: string;
  bush: string;
  bushCount: number;
  /** Little tufts or pebbles scattered for texture. */
  tuft: string;
  tuftCount: number;
  stone: string;
  plaster: string;
  roof: string;
  /** Houses pick from these, so a street does not look copy-pasted. */
  plasters: readonly string[];
  roofs: readonly string[];
}

export const MAP_THEMES: Record<MapId, MapTheme> = {
  meadow: {
    sky: '#8EC9EE',
    fog: '#9ED3F0',
    hemiSky: '#BFE4FF',
    hemiGround: '#5E8C3C',
    sun: '#FFF4DE',
    ground: { hue: 0.26, saturation: 0.45, lightMin: 0.4, lightMax: 0.49 },
    path: { hue: 0.11, saturation: 0.42, lightMin: 0.7, lightMax: 0.76 },
    rock: null,
    rockHeight: 99,
    treeTrunk: '#7A4A28',
    leaves: '#44933C',
    leavesTop: '#59B04A',
    rockColor: '#A8ADA6',
    cactus: '#5E9E4A',
    bush: '#4E9E42',
    bushCount: 70,
    tuft: '#6FBF4A',
    tuftCount: 420,
    stone: '#A6A39A',
    plaster: '#EDE4CF',
    roof: '#B5533C',
    plasters: ['#EDE4CF'],
    roofs: ['#B5533C'],
  },
  castle: {
    sky: '#93C8EC',
    fog: '#A9D2EE',
    hemiSky: '#C4E3FF',
    hemiGround: '#5C8A3E',
    sun: '#FFF2DA',
    ground: { hue: 0.25, saturation: 0.42, lightMin: 0.39, lightMax: 0.47 },
    path: { hue: 0.09, saturation: 0.3, lightMin: 0.56, lightMax: 0.62 },
    rock: null,
    rockHeight: 99,
    treeTrunk: '#6E4528',
    leaves: '#3F8A3A',
    leavesTop: '#52A347',
    rockColor: '#9EA3A0',
    cactus: '#5E9E4A',
    bush: '#4A9440',
    bushCount: 60,
    tuft: '#6CB648',
    tuftCount: 380,
    stone: '#A29D92',
    plaster: '#E6DCC6',
    roof: '#8E4A36',
    plasters: ['#E6DCC6'],
    roofs: ['#8E4A36', '#7A3F2F'],
  },
  city: {
    sky: '#8EC9EE',
    fog: '#BFD9EA',
    hemiSky: '#D8ECFF',
    hemiGround: '#8C7A62',
    sun: '#FFF0D6',
    ground: { hue: 0.08, saturation: 0.12, lightMin: 0.6, lightMax: 0.66 },
    path: { hue: 0.07, saturation: 0.14, lightMin: 0.68, lightMax: 0.74 },
    rock: null,
    rockHeight: 99,
    treeTrunk: '#6E4528',
    leaves: '#3F8A3A',
    leavesTop: '#52A347',
    rockColor: '#B0ACA2',
    cactus: '#5E9E4A',
    bush: '#5C8E46',
    bushCount: 0,
    tuft: '#8B9A6A',
    tuftCount: 0,
    stone: '#BDB4A3',
    plaster: '#EFE3C8',
    roof: '#B5533C',
    plasters: ['#EFE3C8', '#E9CBA0', '#DDB48A', '#F3E6CF', '#E3C2B0'],
    roofs: ['#B5533C', '#A3462F', '#C4643F', '#9C5236'],
  },
};

export const MAP_NAMES: Record<MapId, string> = {
  meadow: 'Green Meadow',
  castle: 'Castle Siege',
  city: 'The City',
};

/** Town houses: roof proportions and window rows. */
export const HOUSE = {
  roofShare: 0.3,
  roofPitch: 0.45,
  floorHeight: 3,
  firstWindow: 1.9,
  twoWindowWidth: 4.5,
} as const;

export const LIGHTING = {
  hemiIntensity: 0.85,
  sunIntensity: 0.95,
  sunDirection: [-26, -42, -18] as const,
  shadowMapSize: 2048,
  shadowRange: 45,
  fogStart: 70,
  fogEnd: 210,
} as const;

export const CAMERA = {
  fov: 0.84,
  /** Close behind and low, at about the soldiers' eye level. */
  distance: 6.5,
  minDistance: 3.5,
  maxDistance: 22,
  height: 1.9,
  minPitch: -0.35,
  maxPitch: 1.2,
  startPitch: 0.2,
  mouseSensitivity: 0.0024,
  zoomStep: 0.0035,
  smoothing: 14,
  overviewHeight: 42,
} as const;

export const ANIMATION = {
  walkCycleSpeed: 2.3,
  legSwing: 0.7,
  armSwing: 0.5,
  bob: 0.07,
  swingDuration: 0.35,
  gallopSpeed: 1.25,
  stunWobble: 0.35,
  knockdownStun: 0.9,
  /** Ground speed at which the commander's cape streams out fully. */
  capeFullSpeed: 9,
} as const;

export const EFFECTS = {
  maxCorpses: 220,
  corpseSettleSeconds: 7,
  /** Bodies sink into the ground after a while so the field stays readable. */
  corpseSinkAfter: 25,
  corpseSinkSeconds: 3,
  stuckArrowLifetime: 12,
  maxStuckArrows: 300,
  particleCount: 240,
  deathSpinSpeed: 7,
  deathLaunchScale: 1.4,
  deathLiftMin: 3.5,
  popupLifetime: 0.9,
  shoutPopupLifetime: 1.6,
  shoutRings: 4,
  shoutRingGap: 0.14,
  shoutRingLife: 0.7,
  shoutRingTravel: 3,
  /** The feast table stays a while after the banquet, for the drunks to stagger around. */
  feastPropSeconds: 40,
} as const;

export const FORMATION_WHEEL = {
  /** Holding `2` longer than this opens the wheel; a shorter tap just holds. */
  openDelay: 0.18,
  /** Mouse travel (px) before an option is picked. */
  deadzone: 26,
  /** How far the wheel cursor can travel (px). */
  radius: 90,
  /** The cursor must point within ~60° of an option to pick it. */
  minAlignment: 0.5,
  /** Distance (px) of the options from the center of the wheel. */
  optionDistance: 150,
} as const;

/** Mixing and behaviour of the synthesized sound. Volumes are linear gains. */
export const SOUND = {
  master: 0.8,
  music: 0.35,
  effects: 0.9,
  /** At most this many effects and voices play at once. */
  maxVoices: 28,
  /** The same kind of sound waits this long before it may play again. */
  defaultGap: 0.03,
  /** In a melee, blows and grunts of one kind are thinned out to this rate. */
  crowdGap: 0.06,
  voiceGap: 0.25,
  /** Seconds a sound keeps its slot. */
  defaultLength: 0.8,
  voiceLength: 2,
  speechLength: 4,
  /** Sounds fade with distance: half as loud at `falloff` meters, silent beyond `maxDistance`. */
  falloff: 14,
  maxDistance: 70,
  panWidth: 0.8,
  /** Effects are scheduled this far ahead on the audio clock. */
  scheduleAhead: 0.02,
  oofChance: 0.35,
  /** Somebody mutters every few seconds. */
  chatterEvery: 3,
  cheerVoices: 8,
  glugs: 5,
  musicTempo: 96,
  musicTickMs: 50,
  musicLookahead: 0.2,
} as const;

export const HUD = {
  enemyLookAngle: 0.22,
  enemyLookMaxDistance: 90,
  edgeToastSeconds: 2.2,
  killFeedSeconds: 5,
  killFeedMax: 5,
} as const;
