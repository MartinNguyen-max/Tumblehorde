import { ARMY, MOVEMENT } from './config.ts';
import { FORMATION } from './config.ts';
import { followCenter, formationSlots, type FormationShape } from './formation.ts';
import { clamp, dirToYaw, distanceXZ, turnTowards, type Vec2 } from './math.ts';
import { toggleMount } from './mounts.ts';
import type { Army, Command, EntityId, GroupOrder, MatchState, Order, Unit, UnitKind } from './types.ts';
import { getUnit, setWeapon } from './units.ts';

/**
 * Splitting is by unit type, so groups are tactically useful:
 * 2 groups = melee | archers, 3 groups = swordsmen | archers | riders.
 */
export function groupForKind(kind: UnitKind, groupCount: number): number {
  if (groupCount <= 1) return 0;
  if (kind === 'archer') return 1;
  if (groupCount === 2) return 0;
  return kind === 'rider' ? 2 : 0;
}

export function livingSoldiers(state: MatchState, army: Army): Unit[] {
  const result: Unit[] = [];
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (unit?.alive) result.push(unit);
  }
  return result;
}

export function centroid(units: readonly Unit[]): Vec2 | null {
  if (units.length === 0) return null;
  let x = 0;
  let z = 0;
  for (const u of units) {
    x += u.pos.x;
    z += u.pos.z;
  }
  return { x: x / units.length, z: z / units.length };
}

export function groupMembers(state: MatchState, army: Army, group: number): Unit[] {
  return livingSoldiers(state, army).filter((u) => u.group === group);
}

/** Center of everything still standing in the army, including the commander. */
export function armyCenter(state: MatchState, army: Army): Vec2 | null {
  const members = livingSoldiers(state, army);
  const commander = state.units[army.commanderId];
  if (commander?.alive) members.push(commander);
  return centroid(members);
}

export function canGiveOrders(state: MatchState, army: Army): boolean {
  const commander = state.units[army.commanderId];
  return !army.eliminated && commander?.alive === true && livingSoldiers(state, army).length > 0;
}

/** Center of the nearest army on another team. */
export function nearestEnemyCenter(state: MatchState, army: Army, from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDistance = Infinity;
  for (const other of state.armies) {
    if (other.eliminated || other.team === army.team) continue;
    const center = armyCenter(state, other);
    if (!center) continue;
    const d = distanceXZ(from, center);
    if (d < bestDistance) {
      best = center;
      bestDistance = d;
    }
  }
  return best;
}

function orderFor(state: MatchState, army: Army, order: Order, group: number): GroupOrder {
  const commander = state.units[army.commanderId];
  const yaw = commander?.yaw ?? 0;
  if (order === 'hold') {
    const here = centroid(groupMembers(state, army, group)) ?? { x: commander?.pos.x ?? 0, z: commander?.pos.z ?? 0 };
    // A holding line faces the enemy, whichever way the commander happened to look.
    const enemy = nearestEnemyCenter(state, army, here);
    return { order, anchor: here, anchorYaw: enemy ? dirToYaw(enemy.x - here.x, enemy.z - here.z) : yaw };
  }
  return { order, anchor: { x: commander?.pos.x ?? 0, z: commander?.pos.z ?? 0 }, anchorYaw: yaw };
}

/** `leaderless` lets an army without a standing commander order itself. */
export function issueOrder(state: MatchState, army: Army, order: Order, group: number | null, leaderless = false): boolean {
  if (!(leaderless ? canActLeaderless(state, army) : canGiveOrders(state, army))) return false;
  if (group !== null && (group < 0 || group >= army.groupCount)) return false;
  for (let g = 0; g < army.groupCount; g++) {
    if (group === null || group === g) army.groupOrders[g] = orderFor(state, army, order, g);
  }
  state.events.push({ type: 'order', armyId: army.id, group, order });
  return true;
}

function canActLeaderless(state: MatchState, army: Army): boolean {
  return !army.eliminated && livingSoldiers(state, army).length > 0;
}

export function splitArmy(state: MatchState, army: Army, groupCount: number, leaderless = false): boolean {
  if (!(leaderless ? canActLeaderless(state, army) : canGiveOrders(state, army))) return false;
  const count = clamp(Math.round(groupCount), 1, ARMY.maxGroups);
  const previous = army.groupOrders[0]?.order ?? 'hold';
  army.groupCount = count;
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (unit) unit.group = groupForKind(unit.kind, count);
  }
  army.groupOrders = [];
  for (let g = 0; g < count; g++) army.groupOrders.push(orderFor(state, army, previous, g));
  state.events.push({ type: 'split', armyId: army.id, groupCount: count });
  return true;
}

export function applyCommand(state: MatchState, armyId: number, command: Command): boolean {
  const army = state.armies[armyId];
  if (!army || army.eliminated || state.phase !== 'playing') return false;
  switch (command.type) {
    case 'order':
      return issueOrder(state, army, command.order, command.group);
    case 'split':
      return splitArmy(state, army, command.groupCount);
    case 'mount': {
      const commander = state.units[army.commanderId];
      return commander ? toggleMount(state, commander) : false;
    }
    case 'weapon': {
      const commander = state.units[army.commanderId];
      return commander ? setWeapon(commander, command.weapon) : false;
    }
  }
}

/** Following groups track their commander and turn with the direction they walk. */
export function updateFollowAnchors(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    const commander = state.units[army.commanderId];
    if (!commander?.alive) continue;
    const speed = Math.hypot(commander.vel.x, commander.vel.z);
    for (const groupOrder of army.groupOrders) {
      if (groupOrder.order !== 'follow') continue;
      groupOrder.anchor = { x: commander.pos.x, z: commander.pos.z };
      if (speed > MOVEMENT.followTurnMinSpeed) {
        const heading = dirToYaw(commander.vel.x, commander.vel.z);
        groupOrder.anchorYaw = turnTowards(groupOrder.anchorYaw, heading, MOVEMENT.followTurnRate * dt);
      }
    }
  }
}

/** Formation slot for every living soldier in the army, based on their group's order. */
export function formationTargets(state: MatchState, army: Army): Map<EntityId, Vec2> {
  const targets = new Map<EntityId, Vec2>();
  for (let g = 0; g < army.groupCount; g++) {
    const groupOrder = army.groupOrders[g];
    if (!groupOrder) continue;
    const members = groupMembers(state, army, g);
    if (members.length === 0) continue;
    const center =
      groupOrder.order === 'follow'
        ? followCenter(groupOrder.anchor, groupOrder.anchorYaw, g, army.groupCount, members.length)
        : groupOrder.anchor;
    const slots = formationSlots(
      members.map((m) => m.kind),
      center,
      groupOrder.anchorYaw,
      formationShape(groupOrder, members),
    );
    members.forEach((m, i) => {
      const slot = slots[i];
      if (slot) targets.set(m.id, slot);
    });
  }
  return targets;
}

const SHIELD_WALL: FormationShape = { spacing: FORMATION.shieldWallSpacing, rowWidth: FORMATION.shieldWallRowWidth };

/** Swordsmen holding their ground close ranks into a shield wall. */
function formationShape(groupOrder: GroupOrder, members: readonly Unit[]): FormationShape | undefined {
  const allSwords = members.every((m) => m.kind === 'swordsman');
  return groupOrder.order === 'hold' && allSwords ? SHIELD_WALL : undefined;
}

export function orderOf(army: Army, unit: Unit): GroupOrder | null {
  return army.groupOrders[unit.group] ?? army.groupOrders[0] ?? null;
}

export function commanderOf(state: MatchState, army: Army): Unit | null {
  return getUnit(state, army.commanderId);
}
