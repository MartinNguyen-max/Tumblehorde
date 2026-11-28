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
  ice: '#CDEBF7',
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
  /** A bright edge and a dark groove make the blade read as a blade, even small. */
  bladeEdge: '#D9E0E6',
  bladeGroove: '#6F7882',
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

/** Viking looks: every warrior picks a beard, a pelt, a skin tone and maybe a helmet and a scar. */
export const VIKING_LOOK = {
  skins: ['#E8B08C', '#DDA27E', '#F0C2A0', '#D49272'],
  skinShades: ['#D49A76', '#C98E6A', '#DFAE8C', '#BE7E5E'],
  beards: ['#D9B45A', '#B8522A', '#6B4423', '#2A211C', '#C7C2B8', '#E3C77A'],
  pelts: [
    { fur: '#8D9094', tuft: '#C1C4C7' },
    { fur: '#5B3E2B', tuft: '#7A5639' },
    { fur: '#A39A88', tuft: '#D7CFBE' },
  ],
  wool: '#5E5248',
  wraps: '#B8A98C',
  leather: '#5A3A24',
  iron: '#7C848B',
  ironDark: '#545B61',
  scar: '#B5545A',
  armRing: '#D9B04A',
  shieldRim: '#6E5A44',
  hornCup: '#E6D6B0',
  mead: '#D9A23A',
  mail: '#8B939A',
} as const;

/** Bandits in hoods and rags; the dead in what is left of whatever they were buried in. */
export const FOLK_LOOK = {
  banditSkins: ['#D9A47E', '#C98F68', '#E3B48E'],
  hoods: ['#5B4A3A', '#4A4038', '#6B5A44'],
  rags: '#7A6A52',
  stubble: '#5A4636',
  plainWood: '#8A6440',
  deadSkins: ['#8FA68A', '#9DB09A', '#7E957F'],
  deadShade: '#6F8470',
  deadEyes: '#E8FF9A',
  deadRags: '#4E4638',
  deadCloth: '#5E5A52',
  rust: '#7A5A44',
  deadHair: '#B8B8AE',
  grave: '#3E3A34',
} as const;

/** The story's named people in battle: who looks like what (beard colors and the like). */
export const STORY_LOOKS = {
  /** Eirik: a young Viking, blond braids, a wolf pelt, no helmet. */
  eirik: { beard: '#E3C77A', pelt: 1 },
  /** Hrolf the Red: a red-bearded jarl. */
  hrolfBeard: '#B8401E',
  /** Varro, the old smith: a big grey beard on a legionary's body. */
  varroBeard: '#B9B4AA',
  /** Cassian: a brown beard while he wanders, white when he is old. */
  cassianBeard: '#6B4423',
  oldBeard: '#ECEAE4',
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
  /** Frozen water, if the map has any. */
  ice?: HslRange;
  /** Snow falls around the camera. */
  snow?: boolean;
}

const BATTLE_THEMES: Record<'meadow' | 'castle' | 'city' | 'north', MapTheme> = {
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
  north: {
    sky: '#B9CEDC',
    fog: '#D4E2EA',
    hemiSky: '#E4EEF6',
    hemiGround: '#8FA2AE',
    sun: '#F4F6FF',
    ground: { hue: 0.57, saturation: 0.22, lightMin: 0.86, lightMax: 0.93 },
    path: { hue: 0.08, saturation: 0.14, lightMin: 0.6, lightMax: 0.67 },
    rock: { hue: 0.58, saturation: 0.06, lightMin: 0.55, lightMax: 0.62 },
    rockHeight: 6,
    treeTrunk: '#5A3E2A',
    leaves: '#2F5A46',
    leavesTop: '#EEF4F7',
    rockColor: '#8E979C',
    cactus: '#5E9E4A',
    bush: '#3E6450',
    bushCount: 40,
    tuft: '#D9E4EA',
    tuftCount: 300,
    stone: '#7D8489',
    plaster: '#6B4A32',
    roof: '#EEF3F6',
    // Dark timber longhouses under snow-covered roofs.
    plasters: ['#6B4A32', '#5E4230', '#74503A'],
    roofs: ['#EEF3F6', '#E3EBF0'],
    ice: { hue: 0.54, saturation: 0.5, lightMin: 0.74, lightMax: 0.82 },
    snow: true,
  },
};

/** The story's own places look like their battlefield cousins: woods darker, the fortress snowed in. */
export const MAP_THEMES: Record<MapId, MapTheme> = {
  ...BATTLE_THEMES,
  // Campaign only: the Colosseum's sand floor inside a stone podium wall.
  arena: {
    sky: '#8EC9EE',
    fog: '#C8DCEA',
    hemiSky: '#CFE4F4',
    hemiGround: '#A08860',
    sun: '#FFF0D8',
    ground: { hue: 0.1, saturation: 0.45, lightMin: 0.62, lightMax: 0.68 },
    path: { hue: 0.1, saturation: 0.45, lightMin: 0.62, lightMax: 0.68 },
    rock: null,
    rockHeight: 99,
    treeTrunk: '#7A4A28',
    leaves: '#44933C',
    leavesTop: '#59B04A',
    rockColor: '#A8ADA6',
    cactus: '#5E9E4A',
    bush: '#4E9E42',
    bushCount: 0,
    tuft: '#B89A6A',
    tuftCount: 160,
    stone: '#C8BCA6',
    plaster: '#E6D8BC',
    roof: '#B5533C',
    plasters: ['#E6D8BC'],
    roofs: ['#B5533C'],
  },
  forest: {
    ...BATTLE_THEMES.meadow,
    fog: '#8FB7A2',
    hemiGround: '#3E6A33',
    ground: { hue: 0.27, saturation: 0.42, lightMin: 0.3, lightMax: 0.38 },
    path: { hue: 0.09, saturation: 0.3, lightMin: 0.45, lightMax: 0.52 },
    leaves: '#2F6E34',
    leavesTop: '#3E8A3E',
    bushCount: 140,
    tuftCount: 520,
  },
  village: { ...BATTLE_THEMES.meadow, plasters: ['#EDE4CF', '#E9CBA0', '#F3E6CF'], roofs: ['#B5533C', '#A3462F', '#C4643F'] },
  river: { ...BATTLE_THEMES.meadow },
  fortress: { ...BATTLE_THEMES.north, ice: undefined, plaster: '#D9D2C2', plasters: ['#D9D2C2'], stone: '#9AA0A3' },
  steppe: { ...BATTLE_THEMES.meadow },
  // Under the Greek city: black water, wet brick, no sky to speak of.
  sewers: {
    ...BATTLE_THEMES.city,
    sky: '#0E1012',
    fog: '#14181A',
    // Torchlight: warm from above, the floor giving back a little brown.
    hemiSky: '#C89868',
    hemiGround: '#3A2C20',
    sun: '#D08A50',
    ground: { hue: 0.08, saturation: 0.18, lightMin: 0.16, lightMax: 0.2 },
    path: { hue: 0.3, saturation: 0.15, lightMin: 0.18, lightMax: 0.2 },
    stone: '#5A4A3E',
  },
  longship: {
    ...BATTLE_THEMES.meadow,
    sky: '#E3946A',
    fog: '#B07A68',
    // The sea, under the deck: only seen at the very edge of the world.
    ground: { hue: 0.56, saturation: 0.45, lightMin: 0.26, lightMax: 0.3 },
    path: { hue: 0.56, saturation: 0.45, lightMin: 0.26, lightMax: 0.3 },
  },
};

export const MAP_NAMES: Record<MapId, string> = {
  meadow: 'Green Meadow',
  castle: 'Castle Siege',
  city: 'The City',
  north: 'The Frozen North',
  arena: 'The Arena',
  forest: 'The Forest Road',
  village: 'The Village',
  river: 'The Bridge',
  fortress: 'The Northern Fortress',
  steppe: 'The Open Field',
  sewers: 'The Sewers',
  longship: 'The Longship',
};

/** Falling snow: flakes in a box around the camera, drifting down and sideways. */
export const SNOW = {
  flakes: 900,
  radius: 28,
  height: 18,
  fallSpeed: 2.2,
  drift: 0.8,
  size: 0.07,
  color: '#FFFFFF',
} as const;

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

/** Story battles at dusk and at night: darker skies, dimmer light, closer fog. */
export const TIME_OF_DAY = {
  dusk: { sky: '#E3946A', fog: '#C98A70', hemi: 0.55, sun: 0.75, sunColor: '#FFB07A', fogStart: 50, fogEnd: 170 },
  night: { sky: '#0D1626', fog: '#111C2E', hemi: 0.28, sun: 0.32, sunColor: '#9DB4FF', fogStart: 30, fogEnd: 120 },
} as const;

/** Fire on burning houses and torches in the night camp. */
export const FIRE = {
  flame: '#FF8A2A',
  core: '#FFD25A',
  ember: '#FF5A1F',
  /** Smoke lit from below by the fire, so it shows against a night sky. */
  smoke: '#9A8A7E',
  /** How fast flames flicker, and by how much. */
  flicker: 9,
  flickerAmount: 0.25,
  torchHeight: 2.2,
  /** Flames on a burning house start this big, and smoke rises above them. */
  houseFlame: 2.2,
  /** Fires on the ground next to burning houses: how big, and how far from the wall. */
  groundFlame: 1.3,
  groundFireGap: 1.6,
  smokeLife: 4,
  smokeRise: 9,
  smokeDrift: 3,
  smokeAlpha: 0.35,
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
  /** The camera stops this far in front of a wall between it and the commander... */
  wallMargin: 0.35,
  /** ...checking the line to it every this many meters. */
  wallProbeStep: 0.2,
  /** It never gets closer than this, even with a wall right behind the commander. */
  wallMinDistance: 0.8,
  /** A tree's branches reach this far out and up (times the tree's scale). */
  treeCrown: 1.9,
  treeHeight: 6,
} as const;

/** Looking through the commander's eyes: their head is hidden, the body, shield and sword stay. */
export const FIRST_PERSON = {
  /** Eye height above the feet (the rig is drawn 1.1× its body height). */
  eyeHeight: 1.78,
  /** A little in front of the face, so the inside of the head never shows... */
  eyeForward: 0.12,
  /** ...and further out (and a bit lower) as you look down, like a head bending over its own chest. */
  lookDownForward: 0.3,
  lookDownDrop: 0.2,
  /** Looking up this far, and down far enough to see your own feet. */
  minPitch: -1.2,
  maxPitch: 1.45,
  /** A slightly wider view than behind the shoulder. */
  fov: 1.05,
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
  /** How deep a pilum sinks into whatever it hits. */
  pilumEmbedDepth: 0.35,
  /** Thrown axes turn over this much per meter flown. */
  axeSpinPerMeter: 1.6,
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
  /** Slide whistles are funny once in a while, not forty times a second. */
  whistleGap: 0.35,
  /** Somebody mutters every few seconds. */
  chatterEvery: 3,
  /** After a win: a cheer or a laugh from somewhere in the crowd this often. */
  celebrateEvery: 0.35,
  cheerVoices: 8,
  /** A Viking swinging roars this often. */
  vikingRoarChance: 0.35,
  glugs: 5,
} as const;

/** The minimap in the top left corner. */
/** The minimap's ground per map where it differs from green. */
export const MINIMAP_GROUND: Partial<Record<MapId, string>> = {
  north: 'rgba(120, 135, 150, 0.6)',
  fortress: 'rgba(120, 135, 150, 0.6)',
  forest: 'rgba(26, 48, 28, 0.6)',
  longship: 'rgba(40, 80, 110, 0.6)',
  sewers: 'rgba(40, 30, 24, 0.6)',
};

export const MINIMAP = {
  /** On-screen size (CSS px). */
  size: 170,
  ground: 'rgba(40, 60, 40, 0.55)',
  ice: 'rgba(170, 220, 240, 0.8)',
  building: 'rgba(225, 215, 195, 0.85)',
  dot: 2.6,
  arrow: 6,
  redrawEvery: 0.1,
  /** In the city, sight lines are checked this often. */
  sightEvery: 0.4,
} as const;

export const HUD = {
  /** Story battles: names show over heroes and generals this close to the camera. */
  nameTagDistance: 45,
  enemyLookAngle: 0.22,
  enemyLookMaxDistance: 90,
  edgeToastSeconds: 2.2,
  killFeedSeconds: 5,
  killFeedMax: 5,
} as const;
