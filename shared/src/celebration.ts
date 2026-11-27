import { CELEBRATION } from './config.ts';
import { dirToYaw } from './math.ts';
import { armyCenter } from './orders.ts';
import { nextRandom } from './random.ts';
import type { Army, MatchState, Unit } from './types.ts';
import { armiesHostile } from './units.ts';

/** After the battle is won, everyone left standing on the winning side celebrates. */
export function isCelebrating(state: MatchState, army: Army): boolean {
  // The dead do not cheer: they just keep coming.
  if (state.phase === 'playing' || army.eliminated || army.faction === 'zombie') return false;
  if (state.winnerTeam !== null && army.team !== state.winnerTeam) return false;
  // Won by holding out, with enemies still on the field: keep your guard up.
  return !state.armies.some((other) => !other.eliminated && armiesHostile(state, army.id, other.id));
}

/** Hops, happy spins and turning to the others to cheer. Players keep control of their commander. */
export function celebrate(state: MatchState, army: Army, dt: number): void {
  const center = armyCenter(state, army);
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (unit?.alive) celebrateUnit(state, unit, center, dt);
  }
  if (army.isBot) {
    const commander = army.commanderId === null ? null : state.units[army.commanderId];
    if (commander?.alive) celebrateUnit(state, commander, center, dt);
  }
}

/** Soldiers spin for a fifth of every few seconds, each at their own moment. */
function spinning(state: MatchState, unit: Unit): boolean {
  return (unit.id * CELEBRATION.spinStagger + state.time * CELEBRATION.spinPerSecond) % 1 < CELEBRATION.spinShare;
}

function celebrateUnit(state: MatchState, unit: Unit, center: { x: number; z: number } | null, dt: number): void {
  const intent = unit.intent;
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.attack = false;
  intent.shield = false;
  intent.crouch = false;
  intent.jump = unit.onGround && nextRandom(state.rng) < CELEBRATION.jumpPerSecond * dt;
  if (spinning(state, unit)) {
    intent.faceYaw = unit.yaw + CELEBRATION.spinSpeed * dt;
  } else if (center) {
    intent.faceYaw = dirToYaw(center.x - unit.pos.x, center.z - unit.pos.z);
  }
}
