import { ARMY, WEAPONS } from './config.ts';
import { wrapAngle, type Vec3 } from './math.ts';
import type { Command, CommanderInput, Order, Weapon } from './types.ts';

const ORDERS: readonly Order[] = ['follow', 'hold', 'attack'];

function isWeapon(value: unknown): value is Weapon {
  return typeof value === 'string' && (WEAPONS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function neutralInput(faceYaw = 0): CommanderInput {
  return { moveX: 0, moveZ: 0, faceYaw, jump: false, attack: false, shield: false, aim: null };
}

/** Validates untrusted input from a client. Returns null if it is malformed. */
export function sanitizeInput(raw: unknown): CommanderInput | null {
  if (!isRecord(raw)) return null;
  const moveX = finiteNumber(raw.moveX);
  const moveZ = finiteNumber(raw.moveZ);
  const faceYaw = finiteNumber(raw.faceYaw);
  if (moveX === null || moveZ === null || faceYaw === null) return null;
  const length = Math.hypot(moveX, moveZ);
  const scale = length > 1 ? 1 / length : 1;
  return {
    moveX: moveX * scale,
    moveZ: moveZ * scale,
    faceYaw: wrapAngle(faceYaw),
    jump: raw.jump === true,
    attack: raw.attack === true,
    shield: raw.shield === true,
    aim: sanitizePoint(raw.aim),
  };
}

function sanitizePoint(raw: unknown): Vec3 | null {
  if (!isRecord(raw)) return null;
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  const z = finiteNumber(raw.z);
  return x === null || y === null || z === null ? null : { x, y, z };
}

function isOrder(value: unknown): value is Order {
  return typeof value === 'string' && (ORDERS as readonly string[]).includes(value);
}

/** Validates an untrusted command from a client. Returns null if it is malformed. */
export function sanitizeCommand(raw: unknown): Command | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'order': {
      if (!isOrder(raw.order)) return null;
      const group = raw.group;
      if (group === null) return { type: 'order', order: raw.order, group: null };
      if (typeof group !== 'number' || !Number.isInteger(group) || group < 0 || group >= ARMY.maxGroups) return null;
      return { type: 'order', order: raw.order, group };
    }
    case 'split': {
      const count = raw.groupCount;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > ARMY.maxGroups) return null;
      return { type: 'split', groupCount: count };
    }
    case 'mount':
      return { type: 'mount' };
    case 'weapon':
      return isWeapon(raw.weapon) ? { type: 'weapon', weapon: raw.weapon } : null;
    default:
      return null;
  }
}
