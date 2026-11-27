import { finishFeast } from './banquet.ts';
import { ARMY, BANQUET, FACTION_FORMATIONS, FORMATION, MOVEMENT, PINCER, RALLY, VIKING, VOLLEY } from './config.ts';
import { assignHoldSlots, blockSlots, followCenter, formationSlots, holdSlots, pincerGroups, pincerHorn, supportSlots, type FormationSlot } from './formation.ts';
import { localStep, navGrid, navigate, nearestWalkable } from './navigation.ts';
import { attackGoal, fogOfWar } from './perception.ts';
import { clamp, dirToYaw, distanceXZ, normalizeXZ, turnTowards, type Vec2, type Vec3 } from './math.ts';
import { toggleMount } from './mounts.ts';
import type { Army, Command, EntityId, Formation, GroupOrder, MatchState, Order, RefusedReason, Unit, UnitKind } from './types.ts';
import { armiesHostile, canBeTargeted, getUnit, isSoldier, setWeapon, sideArmyId } from './units.ts';
import { nextRandom } from './random.ts';

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
    if (other.eliminated || !armiesHostile(state, army.id, other.id)) continue;
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
  // An order to the whole army brings split halves back together.
  if (group === null && isSplitInHalves(state, army)) mergeHalves(state, army);
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
  // Along the streets, not through the houses.
  const waypoint = navigate(state.settings.map, here, target) ?? localStep(state.settings.map, here, target) ?? target;
  const dir = normalizeXZ(waypoint.x - here.x, waypoint.z - here.z);
  const anchor = nearestWalkable(state.settings.map, { x: here.x + dir.x * step, z: here.z + dir.z * step });
  holdAt(state, army, anchor, dirToYaw(dir.x, dir.z));
  return true;
}

/** The whole army holds at a given spot, facing `yaw`, in its current formation. */
export function holdAt(state: MatchState, army: Army, anchor: Vec2, yaw: number): void {
  finishFeast(state, army);
  for (let g = 0; g < army.groupCount; g++) {
    army.groupOrders[g] = { order: 'hold', anchor: { ...anchor }, anchorYaw: yaw, aroundCommander: false, formation: army.formation };
  }
}

/**
 * Once per battle: every soldier (of `group`, or all) still carrying a spear throws it at an
 * enemy near the spot `at` the commander looked at, if one is in range; one after another.
 */
export function throwSpears(state: MatchState, army: Army, at: Vec3, group: number | null): boolean {
  if (!canGiveOrders(state, army)) return false;
  if (army.spearsThrown) return refuse(state, army, 'spearsSpent');
  const targets = state.units.filter(
    (u) => canBeTargeted(u) && armiesHostile(state, army.id, sideArmyId(state, u)) && distanceXZ(u.pos, at) <= VOLLEY.targetRadius,
  );
  let throwers = 0;
  for (const soldier of livingSoldiers(state, army)) {
    if ((group !== null && soldier.group !== group) || soldier.kind !== 'swordsman' || soldier.spearThrown) continue;
    if (soldier.stunTimer > 0 || soldier.action !== 'none') continue;
    // Spears are only thrown at someone: the one volley is not wasted on empty ground.
    const range = soldier.faction === 'viking' ? VIKING.throwRange : VOLLEY.range;
    const inRange = targets.filter((t) => distanceXZ(t.pos, soldier.pos) <= range);
    if (inRange.length === 0) continue;
    const target = inRange[Math.floor(nextRandom(state.rng) * inRange.length)] ?? null;
    soldier.weapon = 'spear';
    soldier.action = 'throw';
    soldier.actionTimer = VOLLEY.windup + nextRandom(state.rng) * VOLLEY.maxDelay;
    soldier.ai.throwTargetId = target?.id ?? null;
    soldier.ai.throwAt = { ...at };
    throwers++;
  }
  if (throwers === 0) return refuse(state, army, 'noTargetInRange');
  army.spearsThrown = true;
  state.events.push({ type: 'volley', armyId: army.id });
  return true;
}

/**
 * How far a holding group can step forward along `dir` before its front line would walk into an
 * enemy in its way: a line stops at the enemy's shields instead of marching through them.
 */
export function roomToAdvance(state: MatchState, army: Army, order: GroupOrder, dir: Vec2): number {
  const front = order.aroundCommander ? FORMATION.holdLineAhead : 0;
  let room: number = FORMATION.advanceStep;
  for (const unit of state.units) {
    if (!canBeTargeted(unit) || !armiesHostile(state, army.id, sideArmyId(state, unit))) continue;
    const rx = unit.pos.x - order.anchor.x;
    const rz = unit.pos.z - order.anchor.z;
    const ahead = rx * dir.x + rz * dir.z;
    if (ahead <= 0 || Math.abs(rx * dir.z - rz * dir.x) > FORMATION.advanceCorridor) continue;
    room = Math.min(room, ahead - front - FORMATION.advanceEnemyGap);
  }
  return Math.max(0, room);
}

/** Below this a step forward is not worth taking. */
const MIN_ADVANCE = 0.5;

/** Every holding group (or just `group`) steps forward, turning to face where the commander looks. */
export function advanceFormation(state: MatchState, army: Army, group: number | null): boolean {
  const commander = getUnit(state, army.commanderId);
  if (!commander || !canGiveOrders(state, army)) return false;
  const dir = { x: Math.sin(commander.yaw), z: Math.cos(commander.yaw) };
  let holding = false;
  let moved = false;
  army.groupOrders.forEach((order, g) => {
    if (order.order !== 'hold' || (group !== null && group !== g)) return;
    holding = true;
    const step = roomToAdvance(state, army, order, dir);
    if (step < MIN_ADVANCE) return;
    order.anchor = { x: order.anchor.x + dir.x * step, z: order.anchor.z + dir.z * step };
    order.anchorYaw = commander.yaw;
    moved = true;
  });
  if (!holding) return refuse(state, army, 'notHolding');
  if (!moved) return refuse(state, army, 'enemyAhead');
  state.events.push({ type: 'advance', armyId: army.id, group });
  return true;
}

/** Tells the player an order could not be carried out. Always false, for `return refuse(...)`. */
function refuse(state: MatchState, army: Army, reason: RefusedReason): false {
  state.events.push({ type: 'refused', armyId: army.id, reason });
  return false;
}

/** Once per battle: the army gathers round the commander, drinks, and is drunk for good. */
export function startBanquet(state: MatchState, army: Army): boolean {
  if (!canGiveOrders(state, army)) return false;
  if (army.banquet !== 'ready') return refuse(state, army, 'banquetSpent');
  army.banquet = 'feasting';
  army.feastTimer = BANQUET.feastTime;
  state.events.push({ type: 'banquet', armyId: army.id });
  return true;
}

/** A rousing speech: the army fights with courage for a while (harder blows, steadier on its feet). */
export function rally(state: MatchState, army: Army): boolean {
  if (army.commanderId === null || !canGiveOrders(state, army)) return false;
  if (army.rallyTimer > 0) return refuse(state, army, 'rallyResting');
  army.rallyTimer = RALLY.cooldown;
  army.courageTimer = RALLY.courageTime;
  state.events.push({ type: 'rally', armyId: army.id, commanderId: army.commanderId });
  return true;
}

/** Picks the formation for Hold and forms it up at once, for one group or the whole army. */
/** Each people has its own formations (see `FACTION_FORMATIONS`). */
export function knowsFormation(army: Army, formation: Formation): boolean {
  return (FACTION_FORMATIONS[army.faction] as readonly Formation[]).includes(formation);
}

export function setFormation(state: MatchState, army: Army, formation: Formation, group: number | null = null): boolean {
  if (!canGiveOrders(state, army) || (group !== null && (group < 0 || group >= army.groupCount))) return false;
  if (!knowsFormation(army, formation)) return false;
  army.formation = formation;
  return issueOrder(state, army, 'hold', group);
}

/** All swordsmen: the army can be split into two halves to come at the enemy from two sides. */
function isLegion(state: MatchState, army: Army): boolean {
  return livingSoldiers(state, army).every((s) => s.kind === 'swordsman');
}

export const HALVES = 2;

export function isSplitInHalves(state: MatchState, army: Army): boolean {
  return army.groupCount === HALVES && isLegion(state, army);
}

/**
 * Splits the army into a left and a right half, as seen from the commander. Both halves keep
 * the current order until told otherwise.
 */
export function splitInHalves(state: MatchState, army: Army): boolean {
  if (!canGiveOrders(state, army) || !isLegion(state, army)) return false;
  const commander = getUnit(state, army.commanderId);
  if (!commander) return false;
  const forward = { x: Math.sin(commander.yaw), z: Math.cos(commander.yaw) };
  const side = (u: Unit): number => (u.pos.x - commander.pos.x) * forward.z - (u.pos.z - commander.pos.z) * forward.x;
  const soldiers = livingSoldiers(state, army).sort((a, b) => side(a) - side(b) || a.id - b.id);
  const half = Math.ceil(soldiers.length / HALVES);
  soldiers.forEach((s, i) => (s.group = i < half ? 0 : 1));
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (unit && !unit.alive) unit.group = 0;
  }
  const current = army.groupOrders[0] ?? orderFor(state, army, 'hold', 0, false);
  army.groupCount = HALVES;
  army.groupOrders = [0, 1].map((g) => halfOrder(current, soldiers.filter((s) => s.group === g)));
  state.events.push({ type: 'split', armyId: army.id, groupCount: HALVES });
  return true;
}

/**
 * A half keeps the army's order. A holding half holds where it stands now, in the same shape,
 * so the two halves do not pile onto the same spot.
 */
function halfOrder(current: GroupOrder, half: readonly Unit[]): GroupOrder {
  const here = centroid(half);
  if (current.order !== 'hold' || !here) return { ...current, anchor: { ...current.anchor }, pincer: undefined };
  return { ...current, anchor: here, aroundCommander: false, pincer: undefined };
}

function mergeHalves(state: MatchState, army: Army): void {
  const current = army.groupOrders[0];
  army.groupCount = ARMY.maxGroups;
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (unit) unit.group = groupForKind(unit.kind, ARMY.maxGroups);
  }
  army.groupOrders = Array.from({ length: ARMY.maxGroups }, () => (current ? { ...current, anchor: { ...current.anchor } } : orderFor(state, army, 'hold', 0, false)));
  state.events.push({ type: 'split', armyId: army.id, groupCount: 1 });
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
      if (state.settings.noSplit) return false;
      if (command.groupCount === HALVES && isLegion(state, army)) return splitInHalves(state, army);
      return splitArmy(state, army, command.groupCount);
    case 'formation':
      return setFormation(state, army, command.formation, command.group ?? null);
    case 'banquet':
      return startBanquet(state, army);
    case 'rally':
      return rally(state, army);
    case 'advance':
      return advanceFormation(state, army, command.group);
    case 'volley':
      return throwSpears(state, army, command.at, command.group);
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
    // Attacking blind in the city: head for the last sighting, or search the streets together.
    const goal = groupOrder.order === 'attack' ? attackGoal(state, army) : null;
    const effective = goal ? { ...groupOrder, anchor: goal } : groupOrder;
    for (const [id, slot] of groupSlots(state, army, effective, g, members)) targets.set(id, walkableSlot(state, slot));
  }
  return targets;
}

/** A place that falls inside a building moves to the nearest spot in the street. */
function walkableSlot(state: MatchState, slot: FormationSlot): FormationSlot {
  if (!navGrid(state.settings.map).hasObstacles) return slot;
  const free = nearestWalkable(state.settings.map, slot);
  return free === slot ? slot : { x: free.x, z: free.z, yaw: slot.yaw };
}

function groupSlots(state: MatchState, army: Army, groupOrder: GroupOrder, group: number, members: readonly Unit[]): Map<EntityId, FormationSlot> {
  const groupCount = army.groupCount;
  const { anchor, anchorYaw: yaw } = groupOrder;
  const result = new Map<EntityId, FormationSlot>();
  // Swordsmen hold in the chosen formation, everyone in their own place.
  if (groupOrder.order === 'hold' && members.every((m) => m.kind === 'swordsman')) {
    if (groupOrder.formation === 'pincer') return pincerGroupSlots(state, army, groupOrder, members);
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

/** Where the enemy facing a pincer stands: its middle, its front (towards us), and how wide it is. */
interface EnemyLine {
  center: Vec2;
  front: Vec2;
  side: Vec2;
  halfWidth: number;
}

function enemyLineNear(state: MatchState, army: Army, anchor: Vec2): EnemyLine | null {
  let center: Vec2 | null = null;
  let spread: Unit[] = [];
  if (fogOfWar(state)) {
    // In the city all we know is the last sighting.
    if (army.intel && distanceXZ(army.intel, anchor) <= PINCER.range) center = { x: army.intel.x, z: army.intel.z };
  } else {
    spread = state.units.filter(
      (u) => u.alive && isSoldier(u) && armiesHostile(state, army.id, u.armyId) && distanceXZ(u.pos, anchor) <= PINCER.range,
    );
    center = centroid(spread);
  }
  if (!center) return null;
  const front = normalizeXZ(anchor.x - center.x, anchor.z - center.z);
  const side = { x: front.z, z: -front.x };
  const reach = spread.map((u) => Math.abs((u.pos.x - center.x) * side.x + (u.pos.z - center.z) * side.z));
  const halfWidth = reach.length > 0 ? Math.max(...reach) : PINCER.assumedHalfWidth;
  return { center, front, side, halfWidth };
}

/** Puts `units` on `slots` (a block facing `yaw` around `center`), each keeping their order in it. */
function placeInBlock(result: Map<EntityId, FormationSlot>, units: readonly Unit[], slots: readonly FormationSlot[], center: Vec2, yaw: number): void {
  const places = assignHoldSlots('double', units.map((u) => u.pos), center, yaw);
  units.forEach((u, i) => {
    const slot = slots[places[i] ?? i];
    if (slot) result.set(u.id, slot);
  });
}

/** The wings are picked once, left and right thirds as the order is given. */
function pincerWings(order: GroupOrder, members: readonly Unit[]): { left: EntityId[]; right: EntityId[] } {
  if (order.pincer) return order.pincer;
  const forward = { x: Math.sin(order.anchorYaw), z: Math.cos(order.anchorYaw) };
  const side = (u: Unit): number => (u.pos.x - order.anchor.x) * forward.z - (u.pos.z - order.anchor.z) * forward.x;
  const sorted = [...members].sort((a, b) => side(a) - side(b) || a.id - b.id);
  const [left, , right] = pincerGroups(members.length);
  order.pincer = { left: sorted.slice(0, left).map((u) => u.id), right: sorted.slice(sorted.length - right).map((u) => u.id) };
  return order.pincer;
}

/**
 * The pincer: the middle holds a shield line; each wing waits ahead of its end, or with an enemy
 * near swings wide past the enemy's flank, then closes in on its back, facing it.
 */
function pincerGroupSlots(state: MatchState, army: Army, order: GroupOrder, members: readonly Unit[]): Map<EntityId, FormationSlot> {
  const { anchor, anchorYaw: yaw, aroundCommander } = order;
  const wings = pincerWings(order, members);
  const left = members.filter((m) => wings.left.includes(m.id));
  const right = members.filter((m) => wings.right.includes(m.id));
  const middle = members.filter((m) => !wings.left.includes(m.id) && !wings.right.includes(m.id));
  const result = new Map<EntityId, FormationSlot>();
  placeInBlock(result, middle, holdSlots('double', middle.length, anchor, yaw, aroundCommander), anchor, yaw);
  const enemy = enemyLineNear(state, army, anchor);
  for (const [units, sign] of [[left, -1], [right, 1]] as const) {
    if (units.length === 0) continue;
    if (!enemy) {
      const horn = pincerHorn(sign, units.length, middle.length, anchor, yaw, aroundCommander);
      placeInBlock(result, units, horn, centroid(units) ?? anchor, yaw);
      continue;
    }
    const { target, facing } = wingTarget(enemy, centroid(units) ?? anchor, sign);
    placeInBlock(result, units, blockSlots(units.length, target, facing), target, facing);
  }
  return result;
}

/** Still in front of the enemy: go round its flank first. Past it: close in behind, facing it. */
function wingTarget(enemy: EnemyLine, wingCenter: Vec2, sign: number): { target: Vec2; facing: number } {
  // Which side of the enemy is which, as seen from our side.
  const sideways = { x: -enemy.side.x * sign, z: -enemy.side.z * sign };
  const out = enemy.halfWidth + PINCER.sideGap;
  const ahead = (wingCenter.x - enemy.center.x) * enemy.front.x + (wingCenter.z - enemy.center.z) * enemy.front.z;
  const target =
    ahead > -PINCER.behindDepth * 0.5
      ? {
          // Just past the enemy's line, so arriving there means the wing is round the flank.
          x: enemy.center.x + sideways.x * out - enemy.front.x * PINCER.behindDepth * PINCER.flankPast,
          z: enemy.center.z + sideways.z * out - enemy.front.z * PINCER.behindDepth * PINCER.flankPast,
        }
      : {
          x: enemy.center.x - enemy.front.x * PINCER.behindDepth + sideways.x * enemy.halfWidth * 0.4,
          z: enemy.center.z - enemy.front.z * PINCER.behindDepth + sideways.z * enemy.halfWidth * 0.4,
        };
  return { target, facing: dirToYaw(enemy.center.x - target.x, enemy.center.z - target.z) };
}

export function orderOf(army: Army, unit: Unit): GroupOrder | null {
  return army.groupOrders[unit.group] ?? army.groupOrders[0] ?? null;
}

export function commanderOf(state: MatchState, army: Army): Unit | null {
  return getUnit(state, army.commanderId);
}
