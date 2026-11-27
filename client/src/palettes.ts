import type { ArmyView, GameMode } from '@tumblehorde/shared';
import { type ArmyPalette, FFA_PALETTES, TEAM_PALETTES } from './visualConfig.ts';

const FALLBACK: ArmyPalette = { body: '#888888', trim: '#555555', name: 'Grey' };

/** A story color's darker trim: the same hue at this share of the brightness. */
const STORY_TRIM_SHADE = 0.7;

function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): string => Math.round(((n >> shift) & 0xff) * factor).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * Story armies wear their own color (the legion's red, the Vikings' blue); otherwise in team mode
 * allies share a color family and in free-for-all every army has its own color.
 */
export function paletteForArmy(armies: readonly (Pick<ArmyView, 'id' | 'team'> & { color?: string | null })[], armyId: number, mode: GameMode): ArmyPalette {
  const army = armies.find((a) => a.id === armyId);
  if (army?.color) return { body: army.color, trim: shade(army.color, STORY_TRIM_SHADE), name: 'Story' };
  if (mode === 'ffa') return FFA_PALETTES[armyId] ?? FALLBACK;
  if (!army) return FALLBACK;
  const teammates = armies.filter((a) => a.team === army.team).map((a) => a.id);
  const family = TEAM_PALETTES[army.team] ?? TEAM_PALETTES[0] ?? [];
  return family[teammates.indexOf(armyId)] ?? family[0] ?? FALLBACK;
}
