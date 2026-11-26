import { FORMATION } from './config.ts';
import { yawToDir, type Vec2 } from './math.ts';
import type { UnitKind } from './types.ts';

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

const FRONT_RING_START = (70 * Math.PI) / 180;
const FRONT_RING_END = (290 * Math.PI) / 180;

/**
 * Hold around the commander at `anchor`, facing `yaw`: group 0 (swordsmen) form a shield-wall
 * front line ahead and a guard ring around the commander, group 1 (archers) stand in rows
 * behind, group 2 (cavalry) waits on the flanks.
 */
export function aroundCommanderSlots(group: number, count: number, anchor: Vec2, yaw: number): Vec2[] {
  const forward = yawToDir(yaw);
  const right = { x: forward.z, z: -forward.x };
  const at = (ahead: number, side: number): Vec2 => ({
    x: anchor.x + forward.x * ahead + right.x * side,
    z: anchor.z + forward.z * ahead + right.z * side,
  });
  const slots: Vec2[] = [];
  const frontCount = Math.min(count, FORMATION.frontLineSize);
  const frontHalfWidth = ((FORMATION.frontLineSize - 1) * FORMATION.shieldWallSpacing) / 2;
  if (group === 0) {
    for (let i = 0; i < frontCount; i++) slots.push(at(FORMATION.frontLineDistance, (i - (frontCount - 1) / 2) * FORMATION.shieldWallSpacing));
    const guards = count - frontCount;
    for (let i = 0; i < guards; i++) {
      const angle = FRONT_RING_START + ((FRONT_RING_END - FRONT_RING_START) * (i + 0.5)) / guards;
      slots.push(at(Math.cos(angle) * FORMATION.guardRingRadius, Math.sin(angle) * FORMATION.guardRingRadius));
    }
  } else if (group === 1) {
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
