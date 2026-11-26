import type { ArmyView, GameMode } from '@tumblehorde/shared';
import { type ArmyPalette, FFA_PALETTES, TEAM_PALETTES } from './visualConfig.ts';

const FALLBACK: ArmyPalette = { body: '#888888', trim: '#555555', name: 'Grey' };

/** In team mode allies share a color family; in free-for-all every army has its own color. */
export function paletteForArmy(armies: readonly Pick<ArmyView, 'id' | 'team'>[], armyId: number, mode: GameMode): ArmyPalette {
  if (mode === 'ffa') return FFA_PALETTES[armyId] ?? FALLBACK;
  const army = armies.find((a) => a.id === armyId);
  if (!army) return FALLBACK;
  const teammates = armies.filter((a) => a.team === army.team).map((a) => a.id);
  const family = TEAM_PALETTES[army.team] ?? TEAM_PALETTES[0] ?? [];
  return family[teammates.indexOf(armyId)] ?? family[0] ?? FALLBACK;
}
