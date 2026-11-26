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
  /** High or steep ground turns into this (rocky highlands). Null keeps the ground color. */
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
  },
  desert: {
    sky: '#8FCBEA',
    fog: '#F1DDB4',
    hemiSky: '#DDEEFF',
    hemiGround: '#C9A56A',
    sun: '#FFE9C4',
    ground: { hue: 0.1, saturation: 0.5, lightMin: 0.66, lightMax: 0.74 },
    path: { hue: 0.08, saturation: 0.42, lightMin: 0.55, lightMax: 0.61 },
    rock: null,
    rockHeight: 99,
    treeTrunk: '#7A5A38',
    leaves: '#6E9B3C',
    leavesTop: '#86B04A',
    rockColor: '#C98B5A',
    cactus: '#4E9445',
    bush: '#9A9A52',
    bushCount: 40,
    tuft: '#C7A46B',
    tuftCount: 260,
    stone: '#D9C29A',
    plaster: '#D8AE7E',
    roof: '#B98455',
  },
  highlands: {
    sky: '#A6C6E2',
    fog: '#C4D2DD',
    hemiSky: '#D6E6F5',
    hemiGround: '#5F6E58',
    sun: '#F4F1E6',
    ground: { hue: 0.6, saturation: 0.06, lightMin: 0.5, lightMax: 0.58 },
    path: { hue: 0.08, saturation: 0.2, lightMin: 0.44, lightMax: 0.5 },
    rock: { hue: 0.6, saturation: 0.07, lightMin: 0.38, lightMax: 0.46 },
    rockHeight: 2.2,
    treeTrunk: '#5E3F26',
    leaves: '#2F6B3A',
    leavesTop: '#3E8048',
    rockColor: '#8E9399',
    cactus: '#4E9445',
    bush: '#6E7C5E',
    bushCount: 20,
    tuft: '#8A8F8C',
    tuftCount: 360,
    stone: '#8C8C88',
    plaster: '#CFC8B8',
    roof: '#5E6B7A',
  },
};

export const MAP_NAMES: Record<MapId, string> = {
  meadow: 'Green Meadow',
  desert: 'Sunbaked Dunes',
  highlands: 'Rocky Highlands',
};

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
  distance: 9,
  minDistance: 4,
  maxDistance: 22,
  height: 2.2,
  minPitch: -0.35,
  maxPitch: 1.2,
  startPitch: 0.32,
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
  optionDistance: 120,
} as const;

export const HUD = {
  enemyLookAngle: 0.22,
  enemyLookMaxDistance: 90,
  edgeToastSeconds: 2.2,
  killFeedSeconds: 5,
  killFeedMax: 5,
} as const;
