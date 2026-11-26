import type { Room } from '@colyseus/sdk';
import {
  type Command,
  type CommanderInput,
  createMatch,
  decodeSnapshot,
  type InputMessage,
  interpolateViews,
  lerp,
  type MapId,
  type MatchView,
  NET,
  neutralInput,
  predictCommanderStep,
  type Roster,
  rosterFor,
  SIM,
  type SimEvent,
  type SnapshotMessage,
  type StartMessage,
  type Unit,
  type Vec3,
} from '@tumblehorde/shared';
import type { Session } from '../game/session.ts';

const SNAPSHOT_BUFFER = 40;
const RENDER_CLOCK_SNAP = 0.3;
const RENDER_CLOCK_CATCH_UP = 0.1;
/** Prediction errors are hidden by blending them out over this many seconds. */
const CORRECTION_TIME = 0.12;
/** Bigger errors than this are snapped (e.g. after a knockback we could not predict). */
const CORRECTION_SNAP_DISTANCE = 3;

interface TimedView {
  time: number;
  view: MatchView;
}

function copyVec(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

/**
 * A battle running on the server. Remote units are drawn slightly in the past, blended
 * between snapshots; the player's own commander is predicted locally and reconciled.
 */
export class OnlineSession implements Session {
  readonly online = true;
  readonly myArmyId: number;
  readonly map: MapId;
  private readonly room: Room;
  private readonly start: StartMessage;
  private readonly roster: Roster;
  private readonly commanderId: number;
  private readonly predicted: Unit;
  private readonly step = 1 / SIM.serverTickRate;
  private snapshots: TimedView[] = [];
  private queuedEvents: { time: number; events: SimEvent[] }[] = [];
  private renderTime: number | null = null;
  private input: CommanderInput = neutralInput();
  private seq = 0;
  private pending: InputMessage[] = [];
  private accumulator = 0;
  private predictedPrevious: Vec3;
  private correction: Vec3 = { x: 0, y: 0, z: 0 };
  private predicting = false;
  private readonly unsubscribe: () => void;

  constructor(room: Room, start: StartMessage) {
    this.room = room;
    this.start = start;
    this.map = start.settings.map;
    const armyId = start.armies[room.sessionId];
    if (armyId === undefined) throw new Error('This player has no army in the battle');
    this.myArmyId = armyId;
    this.roster = rosterFor(start.settings);
    const local = createMatch(start.settings);
    const commanderId = local.armies[armyId]?.commanderId ?? null;
    const commander = commanderId === null ? undefined : local.units[commanderId];
    if (commanderId === null || !commander) throw new Error('Missing commander');
    this.commanderId = commanderId;
    this.predicted = commander;
    this.predictedPrevious = copyVec(commander.pos);
    this.unsubscribe = room.onMessage('snap', (message: SnapshotMessage) => this.receive(message));
  }

  private latest(): MatchView | null {
    return this.snapshots.at(-1)?.view ?? null;
  }

  private receive(message: SnapshotMessage): void {
    const previous = this.latest();
    const view = decodeSnapshot(new Uint8Array(message.bytes), {
      roster: this.roster,
      mode: this.start.settings.mode,
      armySize: this.start.settings.armySize,
      armies: message.armies,
      previous,
    });
    this.snapshots.push({ time: view.time, view });
    if (this.snapshots.length > SNAPSHOT_BUFFER) this.snapshots.shift();
    // Release events as soon as the view starts blending towards this snapshot, so a death
    // event (with its knockback) arrives before the unit is drawn as dead.
    const releaseAt = previous?.time ?? view.time;
    if (message.events.length > 0) this.queuedEvents.push({ time: releaseAt, events: message.events });
    this.reconcile(view, message.ack);
  }

  /** Rewinds the predicted commander to the server's state and replays unacknowledged input. */
  private reconcile(view: MatchView, ack: number): void {
    const server = view.units[this.commanderId];
    if (!server) return;
    const me = this.predicted;
    const canPredict = server.alive && server.mountId === null;
    if (!canPredict) {
      this.predicting = false;
      return;
    }
    const before = copyVec(me.pos);
    me.alive = true;
    me.pos = { x: server.x, y: server.y, z: server.z };
    me.vel = { x: server.vx, y: server.vy, z: server.vz };
    me.yaw = server.yaw;
    me.onGround = server.onGround;
    me.stunTimer = server.stunTimer;
    me.action = server.action;
    me.mountId = null;
    this.pending = this.pending.filter((p) => p.seq > ack);
    for (const p of this.pending) predictCommanderStep(me, p.input, this.step, this.map);
    if (!this.predicting) {
      this.predicting = true;
      this.predictedPrevious = copyVec(me.pos);
      this.correction = { x: 0, y: 0, z: 0 };
      return;
    }
    const jump = Math.hypot(before.x - me.pos.x, before.z - me.pos.z);
    if (jump > CORRECTION_SNAP_DISTANCE) {
      this.correction = { x: 0, y: 0, z: 0 };
      this.predictedPrevious = copyVec(me.pos);
    } else {
      this.correction.x += before.x - me.pos.x;
      this.correction.y += before.y - me.pos.y;
      this.correction.z += before.z - me.pos.z;
    }
  }

  update(dt: number): void {
    this.accumulator += dt;
    while (this.accumulator >= this.step) {
      this.accumulator -= this.step;
      const message: InputMessage = { seq: ++this.seq, input: { ...this.input } };
      this.room.send('input', message);
      this.pending.push(message);
      if (this.pending.length > SIM.serverTickRate * 2) this.pending.shift();
      this.predictedPrevious = copyVec(this.predicted.pos);
      if (this.predicting) predictCommanderStep(this.predicted, message.input, this.step, this.map);
    }
    const decay = Math.exp(-dt / CORRECTION_TIME);
    this.correction.x *= decay;
    this.correction.y *= decay;
    this.correction.z *= decay;
    this.advanceClock(dt);
  }

  private advanceClock(dt: number): void {
    const newest = this.snapshots.at(-1);
    if (!newest) return;
    const target = newest.time - NET.interpolationDelay;
    if (this.renderTime === null || Math.abs(target - this.renderTime) > RENDER_CLOCK_SNAP) {
      this.renderTime = target;
      return;
    }
    this.renderTime += dt;
    this.renderTime += (target - this.renderTime) * RENDER_CLOCK_CATCH_UP;
  }

  view(): MatchView | null {
    const time = this.renderTime;
    if (time === null || this.snapshots.length === 0) return null;
    let view: MatchView | null = null;
    for (let i = this.snapshots.length - 1; i > 0; i--) {
      const b = this.snapshots[i];
      const a = this.snapshots[i - 1];
      if (!a || !b || a.time > time) continue;
      const span = b.time - a.time;
      view = interpolateViews(a.view, b.view, span > 0 ? Math.min(1, (time - a.time) / span) : 1);
      break;
    }
    view ??= this.snapshots[0]?.view ?? null;
    if (!view) return null;
    return this.withPredictedCommander(view);
  }

  private withPredictedCommander(view: MatchView): MatchView {
    if (!this.predicting) return view;
    const t = this.accumulator / this.step;
    const me = this.predicted;
    const units = view.units.slice();
    const server = units[this.commanderId];
    if (!server || !server.alive) return view;
    units[this.commanderId] = {
      ...server,
      x: lerp(this.predictedPrevious.x, me.pos.x, t) + this.correction.x,
      y: lerp(this.predictedPrevious.y, me.pos.y, t) + this.correction.y,
      z: lerp(this.predictedPrevious.z, me.pos.z, t) + this.correction.z,
      yaw: me.yaw,
      vx: me.vel.x,
      vy: me.vel.y,
      vz: me.vel.z,
      onGround: me.onGround,
      shieldUp: me.shieldUp,
    };
    return { ...view, units };
  }

  takeEvents(): SimEvent[] {
    const time = this.renderTime ?? Number.POSITIVE_INFINITY;
    const ready: SimEvent[] = [];
    while (this.queuedEvents.length > 0 && (this.queuedEvents[0]?.time ?? Infinity) <= time) {
      ready.push(...(this.queuedEvents.shift()?.events ?? []));
    }
    return ready;
  }

  setInput(input: CommanderInput): void {
    this.input = input;
  }

  command(command: Command): void {
    this.room.send('command', command);
  }

  dispose(): void {
    this.unsubscribe();
  }
}
