import { dirToYaw, distanceXZ, normalizeXZ, type Vec2, wrapAngle } from '../math.ts';
import { nextRandom, type RandomSource, randomRange } from '../random.ts';
import { NPC } from './config.ts';

/**
 * People in the city: they stroll around their home spot, stop and look around, run from
 * trouble, and lie dazed for a moment when punched. Only some of them can be talked to.
 */

export type NpcRole = 'baker' | 'guard' | 'child' | 'merchant' | 'citizen' | 'reveller' | 'smith';
export type NpcMode = 'idle' | 'walk' | 'flee' | 'out' | 'talk';

export interface Npc {
  id: number;
  role: NpcRole;
  name: string;
  /** Who they say what to: a dialogue id, or null for someone who only shrugs. */
  dialogue: string | null;
  home: Vec2;
  pos: Vec2;
  yaw: number;
  mode: NpcMode;
  /** Seconds left in the current mode (idle, flee, out). */
  timer: number;
  target: Vec2 | null;
  /** Stays on the spot (a guard at a gate, a baker at the stall). */
  stationary: boolean;
}

export interface NpcSpec {
  role: NpcRole;
  name: string;
  home: Vec2;
  yaw?: number;
  dialogue?: string;
  stationary?: boolean;
}

/** Whether a spot is open ground; the city map answers this. */
export type Walkable = (p: Vec2) => boolean;

const OPEN: Walkable = () => true;
const TARGET_TRIES = 6;

export function createNpc(id: number, spec: NpcSpec): Npc {
  return {
    id,
    role: spec.role,
    name: spec.name,
    dialogue: spec.dialogue ?? null,
    home: { ...spec.home },
    pos: { ...spec.home },
    yaw: spec.yaw ?? 0,
    mode: 'idle',
    timer: 0,
    target: null,
    stationary: spec.stationary ?? false,
  };
}

function speedOf(npc: Npc): number {
  if (npc.mode === 'flee') return NPC.fleeSpeed;
  return npc.role === 'child' ? NPC.childSpeed : NPC.walkSpeed;
}

function strollTarget(npc: Npc, rng: RandomSource, walkable: Walkable): Vec2 | null {
  for (let i = 0; i < TARGET_TRIES; i++) {
    const angle = nextRandom(rng) * Math.PI * 2;
    const r = Math.sqrt(nextRandom(rng)) * NPC.wanderRadius;
    const p = { x: npc.home.x + Math.cos(angle) * r, z: npc.home.z + Math.sin(angle) * r };
    if (walkable(p)) return p;
  }
  return null;
}

function rest(npc: Npc, rng: RandomSource): void {
  npc.mode = 'idle';
  npc.target = null;
  npc.timer = randomRange(rng, NPC.idleMin, NPC.idleMax);
}

/** Walks towards `target`; false when it is reached or the way is blocked. */
function walkTowards(npc: Npc, target: Vec2, dt: number, walkable: Walkable): boolean {
  const distance = distanceXZ(npc.pos, target);
  if (distance < NPC.arriveDistance) return false;
  const dir = normalizeXZ(target.x - npc.pos.x, target.z - npc.pos.z);
  const stride = Math.min(distance, speedOf(npc) * dt);
  const next = { x: npc.pos.x + dir.x * stride, z: npc.pos.z + dir.z * stride };
  if (!walkable(next)) return false;
  npc.pos = next;
  npc.yaw = dirToYaw(dir.x, dir.z);
  return true;
}

/** One step of an NPC's life. */
export function stepNpc(npc: Npc, dt: number, rng: RandomSource, walkable: Walkable = OPEN): void {
  switch (npc.mode) {
    case 'talk':
      return;
    case 'out':
    case 'idle':
      npc.timer -= dt;
      if (npc.timer > 0) return;
      if (npc.mode === 'out' || npc.stationary) {
        rest(npc, rng);
        return;
      }
      npc.target = strollTarget(npc, rng, walkable);
      if (npc.target) npc.mode = 'walk';
      else rest(npc, rng);
      return;
    case 'walk':
      if (!npc.target || !walkTowards(npc, npc.target, dt, walkable)) rest(npc, rng);
      return;
    case 'flee':
      npc.timer -= dt;
      if (npc.timer <= 0 || !npc.target || !walkTowards(npc, npc.target, dt, walkable)) rest(npc, rng);
      return;
  }
}

/** Knocks `npc` out for a moment; everyone close by runs away from the spot. */
export function punchNpc(npcs: readonly Npc[], npc: Npc, from: Vec2): void {
  npc.mode = 'out';
  npc.timer = NPC.knockoutTime;
  npc.target = null;
  npc.yaw = dirToYaw(npc.pos.x - from.x, npc.pos.z - from.z);
  for (const other of npcs) {
    if (other === npc || other.mode === 'out' || other.mode === 'talk') continue;
    if (distanceXZ(other.pos, npc.pos) > NPC.fleeRadius) continue;
    const away = normalizeXZ(other.pos.x - npc.pos.x, other.pos.z - npc.pos.z);
    const dir = away.x === 0 && away.z === 0 ? { x: 1, z: 0 } : away;
    other.mode = 'flee';
    other.timer = NPC.fleeTime;
    other.target = { x: other.pos.x + dir.x * NPC.fleeSpeed * NPC.fleeTime, z: other.pos.z + dir.z * NPC.fleeSpeed * NPC.fleeTime };
  }
}

/** The NPC the player is facing within `range`, nearest first; knocked-out people are skipped. */
export function facedNpc(npcs: readonly Npc[], player: Vec2, playerYaw: number, range: number): Npc | null {
  let best: Npc | null = null;
  let bestDistance = Infinity;
  for (const npc of npcs) {
    if (npc.mode === 'out') continue;
    const distance = distanceXZ(npc.pos, player);
    if (distance > range || distance >= bestDistance) continue;
    const toward = dirToYaw(npc.pos.x - player.x, npc.pos.z - player.z);
    if (Math.abs(wrapAngle(toward - playerYaw)) > NPC.facingHalfAngle) continue;
    best = npc;
    bestDistance = distance;
  }
  return best;
}

/** Someone the player can talk to (E), if they face one close enough. */
export function talkableNpc(npcs: readonly Npc[], player: Vec2, playerYaw: number): Npc | null {
  const npc = facedNpc(npcs, player, playerYaw, NPC.talkDistance);
  return npc && npc.mode !== 'flee' ? npc : null;
}

/** The NPC stops and turns to the player for a talk. */
export function startTalk(npc: Npc, player: Vec2): void {
  npc.mode = 'talk';
  npc.target = null;
  npc.yaw = dirToYaw(player.x - npc.pos.x, player.z - npc.pos.z);
}

export function endTalk(npc: Npc, rng: RandomSource): void {
  if (npc.mode === 'talk') rest(npc, rng);
}
