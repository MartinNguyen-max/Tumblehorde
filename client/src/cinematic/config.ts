// Look and feel of the cutscenes. Units: meters, seconds, radians.

export const SKIN = {
  light: '#E8B894',
  warm: '#E2AD86',
  tan: '#C98E66',
  pale: '#EFCDB4',
  /** The dead on the last night. */
  grey: '#9AA69A',
} as const;

export const HAIR = {
  black: '#2A1E18',
  brown: '#5A3A22',
  auburn: '#8A3A1E',
  red: '#B4471E',
  blond: '#D8B25A',
  grey: '#9A9690',
  white: '#E8E6E0',
} as const;

export const CLOTH = {
  robe: '#6B4A2E',
  robeDark: '#4E3420',
  rope: '#C9A66B',
  rags: '#8A7E68',
  ragsDark: '#6A604E',
  tunic: '#B88A54',
  apron: '#5A3A22',
  legion: '#C8423A',
  legionTrim: '#8E2A24',
  purple: '#6A2A7A',
  purpleTrim: '#D8B25A',
  linen: '#E8E0CC',
  healer: '#7A9AB8',
  pelt: '#8A6A48',
  peltLight: '#B8A080',
  vikingTunic: '#3E5A7A',
  bandit: '#4A4A3A',
  steel: '#A3ACB6',
  gold: '#E0B040',
  leather: '#6E4528',
  boots: '#45291A',
} as const;

export const FACE = {
  eyeWhite: '#FFFFFF',
  pupil: '#1B1B22',
  brow: '#3B2A20',
  mouth: '#7A3B2E',
  mouthInside: '#5A1E1A',
  tear: '#9FD8FF',
  blush: '#F08A8A',
  blood: '#9C1E1E',
  scar: '#B0685A',
} as const;

/** How fast faces and limbs move to their targets (per second, exponential). */
export const ACTOR = {
  poseRate: 6,
  faceRate: 10,
  turnRate: 5,
  walkSpeed: 1.6,
  walkCycle: 9,
  blinkMin: 2.2,
  blinkMax: 5.5,
  blinkTime: 0.13,
  /** Mouth flaps per second while talking. */
  talkRate: 9,
  breathRate: 1.6,
  breathAmount: 0.012,
  tearSpeed: 0.18,
  tearDrop: 0.22,
  childScale: 0.68,
  sobRate: 7,
  sobAmount: 0.025,
} as const;

export const SCREEN = {
  letterbox: 0.12,
  fadeTime: 0.8,
  titleFadeTime: 1.2,
} as const;
