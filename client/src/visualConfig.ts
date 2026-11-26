// Visual-only constants for the client. Gameplay numbers live in shared/src/config.ts.

export const COLORS = {
  sky: '#8EC9EE',
  fog: '#9ED3F0',
  accent: '#F08A24',
  skin: '#E8B88A',
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

export const TERRAIN_COLORS = {
  grassHue: 0.26,
  grassSaturation: 0.45,
  grassLightMin: 0.4,
  grassLightMax: 0.49,
  sandHue: 0.11,
  sandSaturation: 0.42,
  sandLightMin: 0.7,
  sandLightMax: 0.76,
} as const;

export const LIGHTING = {
  hemiSky: '#BFE4FF',
  hemiGround: '#5E8C3C',
  hemiIntensity: 0.85,
  sun: '#FFF4DE',
  sunIntensity: 0.95,
  sunDirection: [-26, -42, -18] as const,
  shadowMapSize: 2048,
  shadowRange: 45,
  fogStart: 60,
  fogEnd: 150,
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
} as const;

export const EFFECTS = {
  maxCorpses: 220,
  corpseSettleSeconds: 7,
  stuckArrowLifetime: 12,
  maxStuckArrows: 300,
  particleCount: 240,
  deathSpinSpeed: 7,
  deathLaunchScale: 1.4,
  deathLiftMin: 3.5,
  popupLifetime: 0.9,
} as const;

export const HUD = {
  enemyLookAngle: 0.22,
  enemyLookMaxDistance: 90,
  edgeToastSeconds: 2.2,
  killFeedSeconds: 5,
  killFeedMax: 5,
} as const;
