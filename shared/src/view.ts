import { lerp, wrapAngle } from './math.ts';
import { matchDuration } from './match.ts';
import { livingSoldiers } from './orders.ts';
import type { ActionKind, ArmySize, GameMode, MatchPhase, MatchState, Order, Unit, UnitKind } from './types.ts';

/** What a client needs to draw a unit. Built from the simulation or decoded from the network. */
export interface UnitView {
  id: number;
  kind: UnitKind;
  armyId: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  onGround: boolean;
  shieldUp: boolean;
  stunTimer: number;
  action: ActionKind;
  actionTimer: number;
  invulnerable: boolean;
  mountId: number | null;
  riderId: number | null;
  respawnTimer: number;
  group: number;
}

export interface ArrowView {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface ArmyView {
  id: number;
  team: number;
  name: string;
  isBot: boolean;
  eliminated: boolean;
  forfeited: boolean;
  groupCount: number;
  orders: Order[];
  kills: number;
  deaths: number;
  commanderDeaths: number;
  startingSoldiers: number;
  soldiersAlive: number;
  commanderId: number;
  disconnectTimer: number | null;
}

export interface MatchView {
  time: number;
  duration: number;
  phase: MatchPhase;
  winnerTeam: number | null;
  mode: GameMode;
  armySize: ArmySize;
  units: UnitView[];
  arrows: ArrowView[];
  armies: ArmyView[];
}

export function unitView(u: Unit): UnitView {
  return {
    id: u.id,
    kind: u.kind,
    armyId: u.armyId,
    x: u.pos.x,
    y: u.pos.y,
    z: u.pos.z,
    yaw: u.yaw,
    vx: u.vel.x,
    vy: u.vel.y,
    vz: u.vel.z,
    hp: u.hp,
    maxHp: u.maxHp,
    alive: u.alive,
    onGround: u.onGround,
    shieldUp: u.shieldUp,
    stunTimer: u.stunTimer,
    action: u.action,
    actionTimer: u.actionTimer,
    invulnerable: u.invulnerableTimer > 0,
    mountId: u.mountId,
    riderId: u.riderId,
    respawnTimer: u.respawnTimer,
    group: u.group,
  };
}

export function matchView(state: MatchState): MatchView {
  return {
    time: state.time,
    duration: matchDuration(state),
    phase: state.phase,
    winnerTeam: state.winnerTeam,
    mode: state.settings.mode,
    armySize: state.settings.armySize,
    units: state.units.map(unitView),
    arrows: state.arrows.map((a) => ({ id: a.id, x: a.pos.x, y: a.pos.y, z: a.pos.z, vx: a.vel.x, vy: a.vel.y, vz: a.vel.z })),
    armies: state.armies.map((army) => ({
      id: army.id,
      team: army.team,
      name: army.name,
      isBot: army.isBot,
      eliminated: army.eliminated,
      forfeited: army.forfeited,
      groupCount: army.groupCount,
      orders: army.groupOrders.map((g) => g.order),
      kills: army.stats.kills,
      deaths: army.stats.deaths,
      commanderDeaths: army.stats.commanderDeaths,
      startingSoldiers: army.startingSoldiers,
      soldiersAlive: livingSoldiers(state, army).length,
      commanderId: army.commanderId,
      disconnectTimer: army.disconnectTimer,
    })),
  };
}

/** Teleports (respawns, mounting) should not be smeared across frames. */
const MAX_INTERPOLATION_JUMP = 4;

function lerpUnit(a: UnitView, b: UnitView, t: number): UnitView {
  if (a.alive !== b.alive || Math.hypot(b.x - a.x, b.z - a.z) > MAX_INTERPOLATION_JUMP) return b;
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * t,
  };
}

/** Blends two consecutive views; discrete state (HP, actions...) comes from the newer one. */
export function interpolateViews(a: MatchView, b: MatchView, t: number): MatchView {
  const previousArrows = new Map(a.arrows.map((arrow) => [arrow.id, arrow]));
  return {
    ...b,
    units: b.units.map((unit, i) => {
      const before = a.units[i];
      return before && before.id === unit.id ? lerpUnit(before, unit, t) : unit;
    }),
    arrows: b.arrows.map((arrow) => {
      const before = previousArrows.get(arrow.id);
      if (!before) return arrow;
      return { ...arrow, x: lerp(before.x, arrow.x, t), y: lerp(before.y, arrow.y, t), z: lerp(before.z, arrow.z, t) };
    }),
  };
}
