import { FORMATION, PINCER } from './config.ts';
import { dirToYaw, yawToDir, type Vec2 } from './math.ts';
import type { Formation, UnitKind } from './types.ts';

/** A place in a formation and the way the soldier standing there should face. */
export interface FormationSlot extends Vec2 {
  yaw: number;
}

const KIND_RANK: Record<UnitKind, number> = {
  swordsman: 0,
  rider: 1,
  archer: 2,
  commander: 3,
  horse: 4,
};

/** Front rank first: swordsmen, then riders, then archers at the back. */
export function formationRank(kind: UnitKind): number {
  return KIND_RANK[kind];
}

export interface FormationShape {
  spacing: number;
  rowWidth: number;
}

const DEFAULT_SHAPE: FormationShape = { spacing: FORMATION.spacing, rowWidth: FORMATION.rowWidth };

/**
 * Slots for a block formation centered at `center`, with the front row facing `yaw`.
 * The returned slots match the order of `kinds`.
 */
export function formationSlots(kinds: readonly UnitKind[], center: Vec2, yaw: number, shape: FormationShape = DEFAULT_SHAPE): Vec2[] {
  const order = kinds
    .map((kind, index) => ({ kind, index }))
    .sort((a, b) => formationRank(a.kind) - formationRank(b.kind) || a.index - b.index);
  const forward = yawToDir(yaw);
  const right = { x: forward.z, z: -forward.x };
  const rows = Math.ceil(order.length / shape.rowWidth);
  const depth = (rows - 1) * shape.spacing;
  const slots: Vec2[] = new Array<Vec2>(kinds.length);
  order.forEach((entry, sortedIndex) => {
    const row = Math.floor(sortedIndex / shape.rowWidth);
    const inRow = Math.min(shape.rowWidth, order.length - row * shape.rowWidth);
    const col = sortedIndex % shape.rowWidth;
    const side = (col - (inRow - 1) / 2) * shape.spacing;
    const back = row * shape.spacing - depth / 2;
    slots[entry.index] = {
      x: center.x + right.x * side - forward.x * back,
      z: center.z + right.z * side - forward.z * back,
    };
  });
  return slots;
}


const FULL_TURN = Math.PI * 2;

/**
 * How many soldiers stand in each rank, front rank first, for the ranked formations:
 * one long line, two lines, a wedge widening backwards from its tip, and a square testudo block.
 */
export function rankSizes(formation: Exclude<Formation, 'circle' | 'pincer'>, count: number): number[] {
  const sizes: number[] = [];
  const fill = (width: (rank: number) => number): number[] => {
    for (let left = count, rank = 0; left > 0; rank++) {
      const n = Math.min(left, Math.max(1, width(rank)));
      sizes.push(n);
      left -= n;
    }
    return sizes;
  };
  switch (formation) {
    case 'line':
      return fill(() => count);
    case 'double':
      return fill(() => Math.ceil(count / 2));
    case 'wedge':
      return fill((rank) => 1 + rank * FORMATION.wedgeGrowth);
    case 'boar':
      return fill((rank) => 1 + rank * FORMATION.boarGrowth);
    case 'square':
      return fill(() => Math.ceil(Math.sqrt(count)));
    case 'swarm':
      return fill(() => FORMATION.swarmRankSize);
  }
}

/** Ranks of soldiers shoulder to shoulder, front rank first; each rank runs left to right, centered. */
export function rankSlots(
  sizes: readonly number[],
  frontCenter: Vec2,
  yaw: number,
  spacing: number = FORMATION.tightSpacing,
  gap: number = FORMATION.rankGap,
): FormationSlot[] {
  const forward = yawToDir(yaw);
  const right = { x: forward.z, z: -forward.x };
  const slots: FormationSlot[] = [];
  sizes.forEach((inRank, rank) => {
    const back = rank * gap;
    for (let col = 0; col < inRank; col++) {
      const side = (col - (inRank - 1) / 2) * spacing;
      slots.push({ x: frontCenter.x + right.x * side - forward.x * back, z: frontCenter.z + right.z * side - forward.z * back, yaw });
    }
  });
  return slots;
}

/** Deterministic -1..1 noise per slot, so a swarm looks the same mob every time it forms. */
function slotNoise(i: number, salt: number): number {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/** A loose screaming mob: ranks far apart, everyone a little off their place. */
function swarmSlots(sizes: readonly number[], frontCenter: Vec2, yaw: number): FormationSlot[] {
  const jitter = FORMATION.swarmJitter;
  return rankSlots(sizes, frontCenter, yaw, FORMATION.swarmSpacing, FORMATION.swarmRankGap).map((slot, i) => ({
    x: slot.x + slotNoise(i, 1) * jitter,
    z: slot.z + slotNoise(i, 2) * jitter,
    yaw: slot.yaw + slotNoise(i, 3) * FORMATION.swarmYawJitter,
  }));
}

export function ringRadius(count: number): number {
  return Math.max(FORMATION.circleMinRadius, (count * FORMATION.tightSpacing) / FULL_TURN);
}

/** A closed ring around `center`, everyone facing outwards; slot 0 faces `yaw`, then clockwise from above. */
export function ringSlots(count: number, center: Vec2, yaw: number): FormationSlot[] {
  const radius = ringRadius(count);
  const slots: FormationSlot[] = [];
  for (let i = 0; i < count; i++) {
    const facing = yaw + (FULL_TURN * i) / count;
    const dir = yawToDir(facing);
    slots.push({ x: center.x + dir.x * radius, z: center.z + dir.z * radius, yaw: facing });
  }
  return slots;
}

/**
 * Slots for a held formation facing `yaw`. Around the commander the lines stand just ahead of
 * `anchor` and the ring closes around it; otherwise the formation is centered on `anchor`.
 */
/** Soldiers on the left wing, in the middle and on the right wing of a pincer. */
export function pincerGroups(count: number): [number, number, number] {
  const wing = Math.floor(count / 3);
  return [wing, count - wing * 2, wing];
}

/** A small two-rank block centered on `front`, facing `yaw`. */
export function blockSlots(count: number, front: Vec2, yaw: number): FormationSlot[] {
  return rankSlots(rankSizes('double', count), front, yaw);
}

/**
 * The pincer at rest: a shield line in the middle and a wing out ahead on either end, like
 * horns. Slots run left wing, middle, right wing. (`pincerFlanks` in orders.ts moves the wings
 * round an enemy.)
 */
function pincerSlots(count: number, anchor: Vec2, yaw: number, aroundCommander: boolean): FormationSlot[] {
  const [left, middle, right] = pincerGroups(count);
  const center = holdSlots('double', middle, anchor, yaw, aroundCommander);
  return [...pincerHorn(-1, left, middle, anchor, yaw, aroundCommander), ...center, ...pincerHorn(1, right, middle, anchor, yaw, aroundCommander)];
}

/** Where a pincer wing (`side` -1 left, 1 right) of `count` waits beside a middle line of `middle`. */
export function pincerHorn(side: number, count: number, middle: number, anchor: Vec2, yaw: number, aroundCommander: boolean): FormationSlot[] {
  const forward = yawToDir(yaw);
  const rightDir = { x: forward.z, z: -forward.x };
  const lineAhead = aroundCommander ? FORMATION.holdLineAhead : FORMATION.rankGap / 2;
  const halfWidth = (Math.ceil(middle / 2) * FORMATION.tightSpacing) / 2;
  const out = halfWidth + PINCER.wingGap + (Math.ceil(count / 2) * FORMATION.tightSpacing) / 2;
  const ahead = lineAhead + PINCER.wingAhead;
  return blockSlots(count, { x: anchor.x + forward.x * ahead + rightDir.x * side * out, z: anchor.z + forward.z * ahead + rightDir.z * side * out }, yaw);
}

export function holdSlots(formation: Formation, count: number, anchor: Vec2, yaw: number, aroundCommander: boolean): FormationSlot[] {
  if (formation === 'circle') return ringSlots(count, anchor, yaw);
  if (formation === 'pincer') return pincerSlots(count, anchor, yaw, aroundCommander);
  const sizes = rankSizes(formation, count);
  const gap = formation === 'swarm' ? FORMATION.swarmRankGap : FORMATION.rankGap;
  const depth = (sizes.length - 1) * gap;
  const forward = yawToDir(yaw);
  // Around the commander the last rank stands just ahead of them; deep formations reach further out.
  const ahead = aroundCommander ? Math.max(FORMATION.holdLineAhead, FORMATION.holdLineAhead - gap + depth) : depth / 2;
  const front = { x: anchor.x + forward.x * ahead, z: anchor.z + forward.z * ahead };
  return formation === 'swarm' ? swarmSlots(sizes, front, yaw) : rankSlots(sizes, front, yaw);
}

/**
 * Who stands where: soldiers keep their order along the line (or around the ring), so nobody
 * has to walk through the formation to reach their place. Returns slot indices per position.
 */
export function assignHoldSlots(formation: Exclude<Formation, 'pincer'>, positions: readonly Vec2[], anchor: Vec2, yaw: number): number[] {
  const forward = yawToDir(yaw);
  const right = { x: forward.z, z: -forward.x };
  const indices = positions.map((_, i) => i);
  const result = new Array<number>(positions.length);
  if (formation === 'circle') {
    const around = (p: Vec2): number => {
      const relative = dirToYaw(p.x - anchor.x, p.z - anchor.z) - yaw;
      return ((relative % FULL_TURN) + FULL_TURN) % FULL_TURN;
    };
    indices.sort((a, b) => around(positionAt(positions, a)) - around(positionAt(positions, b)) || a - b);
    indices.forEach((unitIndex, slot) => (result[unitIndex] = slot));
    return result;
  }
  const ahead = (p: Vec2): number => (p.x - anchor.x) * forward.x + (p.z - anchor.z) * forward.z;
  const side = (p: Vec2): number => (p.x - anchor.x) * right.x + (p.z - anchor.z) * right.z;
  indices.sort((a, b) => ahead(positionAt(positions, b)) - ahead(positionAt(positions, a)) || a - b);
  let start = 0;
  for (const size of rankSizes(formation, positions.length)) {
    const rank = indices.slice(start, start + size).sort((a, b) => side(positionAt(positions, a)) - side(positionAt(positions, b)) || a - b);
    rank.forEach((unitIndex, col) => (result[unitIndex] = start + col));
    start += size;
  }
  return result;
}

function positionAt(positions: readonly Vec2[], index: number): Vec2 {
  return positions[index] ?? { x: 0, z: 0 };
}

/**
 * Hold around the commander for the parked support groups (mixed armies): group 1 (archers)
 * stand in rows behind, group 2 (cavalry) waits on the flanks.
 */
export function supportSlots(group: number, count: number, anchor: Vec2, yaw: number): Vec2[] {
  const forward = yawToDir(yaw);
  const right = { x: forward.z, z: -forward.x };
  const at = (ahead: number, side: number): Vec2 => ({
    x: anchor.x + forward.x * ahead + right.x * side,
    z: anchor.z + forward.z * ahead + right.z * side,
  });
  const slots: Vec2[] = [];
  const frontHalfWidth = ((FORMATION.frontLineSize - 1) * FORMATION.tightSpacing) / 2;
  if (group === 1) {
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / FORMATION.rowWidth);
      const inRow = Math.min(FORMATION.rowWidth, count - row * FORMATION.rowWidth);
      const col = i % FORMATION.rowWidth;
      slots.push(at(-(FORMATION.archerRowsDistance + row * FORMATION.spacing), (col - (inRow - 1) / 2) * FORMATION.spacing));
    }
  } else {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      slots.push(at(FORMATION.frontLineDistance - Math.floor(i / 2) * FORMATION.groupSideOffset * 0.3, side * (frontHalfWidth + FORMATION.cavalryFlankGap)));
    }
  }
  return slots;
}

/**
 * Where a following group's formation is centered relative to its commander:
 * swordsmen right behind, archers behind them, riders on the right flank.
 */
export function followCenter(commander: Vec2, yaw: number, group: number, groupCount: number, kindsCount: number): Vec2 {
  const forward = yawToDir(yaw);
  const right = { x: forward.z, z: -forward.x };
  const rows = Math.ceil(kindsCount / FORMATION.rowWidth);
  let back = FORMATION.followDistance + ((rows - 1) * FORMATION.spacing) / 2;
  let side = 0;
  if (groupCount !== 3) side = (group - (groupCount - 1) / 2) * FORMATION.groupSideOffset;
  else if (group === 1) back += FORMATION.followArcherDepth;
  else if (group === 2) side = FORMATION.followRiderSide;
  return {
    x: commander.x - forward.x * back + right.x * side,
    z: commander.z - forward.z * back + right.z * side,
  };
}
