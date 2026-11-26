import { finishFeast } from './banquet.ts';
import { ARMY, BANQUET, MOVEMENT, RALLY } from './config.ts';
import { assignHoldSlots, followCenter, formationSlots, holdSlots, supportSlots, type FormationSlot } from './formation.ts';
import { clamp, dirToYaw, distanceXZ, normalizeXZ, turnTowards, type Vec2 } from './math.ts';
import { toggleMount } from './mounts.ts';
import type { Army, Command, EntityId, Formation, GroupOrder, MatchState, Order, Unit, UnitKind } from './types.ts';
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
  const commander = getUnit(state, army.commanderId);
  if (commander?.alive) members.push(commander);
  return centroid(members);
}

export function canGiveOrders(state: MatchState, army: Army): boolean {
  const commander = getUnit(state, army.commanderId);
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

function orderFor(state: MatchState, army: Army, order: Order, group: number, leaderless: boolean): GroupOrder {
  const commander = getUnit(state, army.commanderId);
  const yaw = commander?.yaw ?? 0;
  const commanderPos = { x: commander?.pos.x ?? 0, z: commander?.pos.z ?? 0 };
  const formation = army.formation;
  if (order === 'hold' && !leaderless && !army.isBot && commander?.alive) {
    // A player's Hold: form up around me, facing where I look.
    return { order, anchor: commanderPos, anchorYaw: yaw, aroundCommander: true, formation };
  }
  if (order === 'hold') {
    const here = centroid(groupMembers(state, army, group)) ?? commanderPos;
    // Bots and leaderless armies hold where they stand, facing the enemy.
    const enemy = nearestEnemyCenter(state, army, here);
    const facing = enemy ? dirToYaw(enemy.x - here.x, enemy.z - here.z) : yaw;
    return { order, anchor: here, anchorYaw: facing, aroundCommander: false, formation };
  }
  return { order, anchor: commanderPos, anchorYaw: yaw, aroundCommander: false, formation };
}

/** `leaderless` lets an army without a standing commander order itself. */
export function issueOrder(state: MatchState, army: Army, order: Order, group: number | null, leaderless = false): boolean {
  if (!(leaderless ? canActLeaderless(state, army) : canGiveOrders(state, army))) return false;
  if (group !== null && (group < 0 || group >= army.groupCount)) return false;
  // An order breaks up the party; the wine has done its work by then.
  finishFeast(state, army);
  for (let g = 0; g < army.groupCount; g++) {
    if (group === null || group === g) army.groupOrders[g] = orderFor(state, army, order, g, leaderless);
  }
  state.events.push({ type: 'order', armyId: army.id, group, order, formation: army.formation });
  return true;
}

/**
 * An army without a commander marches in formation: it holds a spot `step` meters further
 * towards `target`, and is moved on again before it gets there.
 */
export function advanceArmy(state: MatchState, army: Army, target: Vec2, step: number): boolean {
  if (!canActLeaderless(state, army)) return false;
  const here = centroid(livingSoldiers(state, army));
  if (!here) return false;
  const dir = normalizeXZ(target.x - here.x, target.z - here.z);
  const anchor = { x: here.x + dir.x * step, z: here.z + dir.z * step };
  const anchorYaw = dirToYaw(dir.x, dir.z);
  for (let g = 0; g < army.groupCount; g++) {
    army.groupOrders[g] = { order: 'hold', anchor, anchorYaw, aroundCommander: false, formation: army.formation };
  }
  return true;
}

/** Once per battle: the army gathers round the commander, drinks, and is drunk for good. */
export function startBanquet(state: MatchState, army: Army): boolean {
  if (army.banquet !== 'ready' || !canGiveOrders(state, army)) return false;
  army.banquet = 'feasting';
  army.feastTimer = BANQUET.feastTime;
  state.events.push({ type: 'banquet', armyId: army.id });
  return true;
}

/** A rousing speech. It changes nothing but the soldiers' mood, so it only needs a short pause. */
export function rally(state: MatchState, army: Army): boolean {
  if (army.rallyTimer > 0 || army.commanderId === null || !canGiveOrders(state, army)) return false;
  army.rallyTimer = RALLY.cooldown;
  state.events.push({ type: 'rally', armyId: army.id, commanderId: army.commanderId });
  return true;
}

/** Picks the formation for Hold and forms it up at once. */
export function setFormation(state: MatchState, army: Army, formation: Formation): boolean {
  if (!canGiveOrders(state, army)) return false;
  army.formation = formation;
  return issueOrder(state, army, 'hold', null);
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
  for (let g = 0; g < count; g++) army.groupOrders.push(orderFor(state, army, previous, g, leaderless));
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
    case 'formation':
      return setFormation(state, army, command.formation);
    case 'banquet':
      return startBanquet(state, army);
    case 'rally':
      return rally(state, army);
    case 'mount': {
      const commander = getUnit(state, army.commanderId);
      return commander ? toggleMount(state, commander) : false;
    }
    case 'weapon': {
      const commander = getUnit(state, army.commanderId);
      return commander ? setWeapon(commander, command.weapon) : false;
    }
  }
}

/** Following groups track their commander and turn with the direction they walk. */
export function updateFollowAnchors(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    const commander = getUnit(state, army.commanderId);
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
export function formationTargets(state: MatchState, army: Army): Map<EntityId, FormationSlot> {
  const targets = new Map<EntityId, FormationSlot>();
  for (let g = 0; g < army.groupCount; g++) {
    const groupOrder = army.groupOrders[g];
    if (!groupOrder) continue;
    const members = groupMembers(state, army, g);
    if (members.length === 0) continue;
    for (const [id, slot] of groupSlots(groupOrder, g, army.groupCount, members)) targets.set(id, slot);
  }
  return targets;
}

function groupSlots(groupOrder: GroupOrder, group: number, groupCount: number, members: readonly Unit[]): Map<EntityId, FormationSlot> {
  const { anchor, anchorYaw: yaw } = groupOrder;
  const result = new Map<EntityId, FormationSlot>();
  // The main group (all swordsmen) holds in the chosen formation, everyone in their own place.
  if (groupOrder.order === 'hold' && group === 0) {
    const slots = holdSlots(groupOrder.formation, members.length, anchor, yaw, groupOrder.aroundCommander);
    const places = assignHoldSlots(groupOrder.formation, members.map((m) => m.pos), anchor, yaw);
    members.forEach((m, i) => {
      const slot = slots[places[i] ?? i];
      if (slot) result.set(m.id, slot);
    });
    return result;
  }
  const blockSlots =
    groupOrder.order === 'hold' && groupOrder.aroundCommander
      ? supportSlots(group, members.length, anchor, yaw)
      : formationSlots(
          members.map((m) => m.kind),
          groupOrder.order === 'follow' ? followCenter(anchor, yaw, group, groupCount, members.length) : anchor,
          yaw,
        );
  members.forEach((m, i) => {
    const slot = blockSlots[i];
    if (slot) result.set(m.id, { x: slot.x, z: slot.z, yaw });
  });
  return result;
}

export function orderOf(army: Army, unit: Unit): GroupOrder | null {
  return army.groupOrders[unit.group] ?? army.groupOrders[0] ?? null;
}

export function commanderOf(state: MatchState, army: Army): Unit | null {
  return getUnit(state, army.commanderId);
}
