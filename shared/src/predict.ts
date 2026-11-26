import { applyMapEdge, integrateBody, resolveObstacles, steerPerson } from './physics.ts';
import type { CommanderInput, Unit } from './types.ts';
import { canUseShield } from './units.ts';

/**
 * Moves only the player's own commander, the same way the server does, so the client can
 * show its own movement instantly. Collisions with other bodies and hits stay server-side;
 * reconciliation with server snapshots corrects any difference.
 */
export function predictCommanderStep(unit: Unit, input: CommanderInput, dt: number): void {
  if (!unit.alive || unit.mountId !== null) return;
  if (unit.stunTimer > 0) unit.stunTimer = Math.max(0, unit.stunTimer - dt);
  unit.intent.moveX = input.moveX;
  unit.intent.moveZ = input.moveZ;
  unit.intent.faceYaw = input.faceYaw;
  unit.intent.jump = input.jump;
  unit.shieldUp = input.shield && canUseShield(unit) && unit.stunTimer <= 0 && unit.action === 'none';
  steerPerson(unit, dt);
  integrateBody(unit, dt);
  applyMapEdge(unit);
  resolveObstacles(unit);
}
