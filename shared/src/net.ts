import { ARMY, NET, WEAPONS } from './config.ts';
import { sanitizeCommand, sanitizeInput } from './input.ts';
import { isMapChoice, MAP_IDS, type MapChoice, type MapId, MAPS, mapFromRandom } from './maps.ts';
import { DEFENDER_TEAM } from './spawn.ts';
import { createRandom, nextRandom } from './random.ts';
import { createMatch } from './setup.ts';
import type { ActionKind, ArmySize, Command, Faction, ProjectileKind, CommanderInput, GameMode, MatchPhase, MatchSettings, SimEvent } from './types.ts';
import { unitView, type ArmyView, type ArrowView, type MatchView, type UnitView } from './view.ts';

// ---------- Messages ----------

export const ROOM_NAME = 'battle';

export interface LobbyPlayer {
  sessionId: string;
  name: string;
  team: number;
  connected: boolean;
}

export type RoomPhase = 'lobby' | 'battle';

/**
 * Which peoples fight in an online battle: everyone Roman, everyone Viking, or Romans against
 * Vikings (by team, or every other player in a free-for-all).
 */
export type Peoples = 'romans' | 'vikings' | 'versus';
export const PEOPLES: readonly Peoples[] = ['romans', 'vikings', 'versus'];

export interface LobbyMessage {
  code: string;
  hostId: string;
  phase: RoomPhase;
  mode: GameMode;
  armySize: ArmySize;
  map: MapChoice;
  peoples: Peoples;
  players: LobbyPlayer[];
}

export interface StartMessage {
  settings: MatchSettings;
  /** sessionId → army id */
  armies: Record<string, number>;
}

export interface InputMessage {
  seq: number;
  input: CommanderInput;
}

export interface SnapshotMessage {
  /** Encoded units, arrows and header. */
  bytes: Uint8Array;
  armies: ArmyView[];
  events: SimEvent[];
  /** Last input sequence number the server applied for the receiving client. */
  ack: number;
}

export interface LobbySettingsMessage {
  mode: GameMode;
  armySize: ArmySize;
  map: MapChoice;
  peoples: Peoples;
}

/** The people of player `index` (on `team`) for the lobby's choice. */
export function factionFor(peoples: Peoples, mode: GameMode, index: number, team: number): Faction {
  if (peoples === 'romans') return 'roman';
  if (peoples === 'vikings') return 'viking';
  return (mode === 'ffa' ? index : team) % 2 === 0 ? 'roman' : 'viking';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeInputMessage(raw: unknown): InputMessage | null {
  if (!isRecord(raw)) return null;
  const seq = raw.seq;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null;
  const input = sanitizeInput(raw.input);
  return input ? { seq, input } : null;
}

export function sanitizeCommandMessage(raw: unknown): Command | null {
  return sanitizeCommand(raw);
}

export function sanitizeLobbySettings(raw: unknown): LobbySettingsMessage | null {
  if (!isRecord(raw)) return null;
  const mode = raw.mode === 'ffa' || raw.mode === 'teams' ? raw.mode : null;
  const size = ARMY.sizes.find((s) => s === raw.armySize) ?? null;
  const map = raw.map === undefined ? 'random' : isMapChoice(raw.map) ? raw.map : null;
  const peoples = raw.peoples === undefined ? 'romans' : (PEOPLES.find((p) => p === raw.peoples) ?? null);
  return mode && size && map && peoples ? { mode, armySize: size, map, peoples } : null;
}

/** Names are shown to other players: trim, drop control characters, cap the length. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Commander';
  const clean = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NET.maxNameLength);
  return clean || 'Commander';
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < NET.roomCodeLength; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'A';
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, NET.roomCodeLength);
}

/** In teams on the castle, exactly one player holds the gate. */
function siegeTeamsFit(lobby: Pick<LobbyMessage, 'mode' | 'players'>): boolean {
  return lobby.mode === 'ffa' || lobby.players.filter((p) => p.team === DEFENDER_TEAM).length === 1;
}

/** Free-for-all with any number of players, or two teams that both have someone on them. */
export function canStartBattle(lobby: Pick<LobbyMessage, 'mode' | 'players' | 'map'>): boolean {
  if (lobby.players.length < NET.minPlayers || lobby.players.length > NET.maxPlayers) return false;
  if (lobby.map !== 'random' && MAPS[lobby.map].layout === 'siege' && !siegeTeamsFit(lobby)) return false;
  if (lobby.mode === 'ffa') return true;
  return new Set(lobby.players.map((p) => p.team)).size === 2;
}

/** A random map never lands on the castle when the teams do not fit a siege. */
function randomMap(lobby: LobbyMessage, random: number): MapId {
  const choices = MAP_IDS.filter((m) => MAPS[m].layout !== 'siege' || siegeTeamsFit(lobby));
  return mapFromRandom(random, choices);
}

export function battleSettings(lobby: LobbyMessage, seed: number): MatchSettings {
  return {
    mode: lobby.mode,
    armySize: lobby.armySize,
    armies: lobby.players.map((p, i) => {
      const team = lobby.mode === 'ffa' ? i : p.team;
      return { name: p.name, team, isBot: false, faction: factionFor(lobby.peoples, lobby.mode, i, team) };
    }),
    seed,
    map: lobby.map === 'random' ? randomMap(lobby, nextRandom(createRandom(seed))) : lobby.map,
  };
}

// ---------- Binary snapshot codec ----------

/**
 * The roster (kind, army, max HP of every unit) never changes during a battle and both
 * sides can rebuild it from the match settings, so snapshots only carry what moves.
 */
export type Roster = Pick<UnitView, 'id' | 'kind' | 'armyId' | 'maxHp'>[];

export function rosterFor(settings: MatchSettings): Roster {
  return createMatch(settings).units.map((u) => {
    const v = unitView(u);
    return { id: v.id, kind: v.kind, armyId: v.armyId, maxHp: v.maxHp };
  });
}

const POSITION_SCALE = 100;
const VELOCITY_SCALE = 100;
const HP_SCALE = 10;
const TIMER_SCALE = 20;
const NONE = 0xffff;
const ACTIONS: readonly ActionKind[] = ['none', 'melee', 'shoot', 'throw'];
const PROJECTILES: readonly ProjectileKind[] = ['arrow', 'pilum', 'axe'];
const PHASES: readonly MatchPhase[] = ['playing', 'ending', 'over'];

const FLAG_ALIVE = 1;
const FLAG_GROUND = 2;
const FLAG_SHIELD = 4;
const FLAG_INVULNERABLE = 8;
const FLAG_DRUNK = 16;
const FLAG_CROUCH = 32;

const HEADER_BYTES = 4 + 4 + 1 + 1 + 2 + 2;
const ALIVE_UNIT_BYTES = 1 + 6 + 2 + 6 + 2 + 1 + 1 + 1 + 2 + 2 + 1 + 1 + 1;
const DEAD_UNIT_BYTES = 1 + 1;
/** A downed commander also sends where their body lies, since they get up there. */
const DOWNED_COMMANDER_EXTRA_BYTES = 6;
const ARROW_BYTES = 4 + 1 + 6 + 6;

function quantizeTimer(seconds: number): number {
  return Math.max(0, Math.min(255, Math.round(seconds * TIMER_SCALE)));
}

function clampInt16(value: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}

export function encodeSnapshot(view: MatchView): Uint8Array {
  let size = HEADER_BYTES + view.arrows.length * ARROW_BYTES;
  for (const u of view.units) {
    size += u.alive ? ALIVE_UNIT_BYTES : DEAD_UNIT_BYTES;
    if (!u.alive && u.kind === 'commander') size += DOWNED_COMMANDER_EXTRA_BYTES;
  }
  const buffer = new ArrayBuffer(size);
  const d = new DataView(buffer);
  let o = 0;
  d.setFloat32(o, view.time);
  o += 4;
  d.setFloat32(o, view.duration);
  o += 4;
  d.setUint8(o++, PHASES.indexOf(view.phase));
  d.setInt8(o++, view.winnerTeam ?? -1);
  d.setUint16(o, view.units.length);
  o += 2;
  d.setUint16(o, view.arrows.length);
  o += 2;
  for (const u of view.units) {
    let flags = 0;
    if (u.alive) flags |= FLAG_ALIVE;
    if (u.onGround) flags |= FLAG_GROUND;
    if (u.shieldUp) flags |= FLAG_SHIELD;
    if (u.invulnerable) flags |= FLAG_INVULNERABLE;
    if (u.drunk) flags |= FLAG_DRUNK;
    if (u.crouching) flags |= FLAG_CROUCH;
    d.setUint8(o++, flags);
    if (!u.alive) {
      d.setUint8(o++, quantizeTimer(u.respawnTimer));
      if (u.kind === 'commander') {
        d.setInt16(o, clampInt16(u.x * POSITION_SCALE));
        d.setInt16(o + 2, clampInt16(u.y * POSITION_SCALE));
        d.setInt16(o + 4, clampInt16(u.z * POSITION_SCALE));
        o += 6;
      }
      continue;
    }
    d.setInt16(o, clampInt16(u.x * POSITION_SCALE));
    d.setInt16(o + 2, clampInt16(u.y * POSITION_SCALE));
    d.setInt16(o + 4, clampInt16(u.z * POSITION_SCALE));
    o += 6;
    d.setInt16(o, clampInt16((u.yaw / Math.PI) * 32767));
    o += 2;
    d.setInt16(o, clampInt16(u.vx * VELOCITY_SCALE));
    d.setInt16(o + 2, clampInt16(u.vy * VELOCITY_SCALE));
    d.setInt16(o + 4, clampInt16(u.vz * VELOCITY_SCALE));
    o += 6;
    d.setUint16(o, Math.max(0, Math.round(u.hp * HP_SCALE)));
    o += 2;
    d.setUint8(o++, quantizeTimer(u.stunTimer));
    d.setUint8(o++, ACTIONS.indexOf(u.action));
    d.setUint8(o++, quantizeTimer(u.actionTimer));
    d.setUint16(o, u.mountId ?? NONE);
    d.setUint16(o + 2, u.riderId ?? NONE);
    o += 4;
    d.setUint8(o++, quantizeTimer(u.respawnTimer));
    d.setUint8(o++, u.group);
    d.setUint8(o++, WEAPONS.indexOf(u.weapon));
  }
  for (const a of view.arrows) {
    d.setUint32(o, a.id);
    o += 4;
    d.setUint8(o++, PROJECTILES.indexOf(a.kind));
    d.setInt16(o, clampInt16(a.x * POSITION_SCALE));
    d.setInt16(o + 2, clampInt16(a.y * POSITION_SCALE));
    d.setInt16(o + 4, clampInt16(a.z * POSITION_SCALE));
    o += 6;
    d.setInt16(o, clampInt16(a.vx * VELOCITY_SCALE));
    d.setInt16(o + 2, clampInt16(a.vy * VELOCITY_SCALE));
    d.setInt16(o + 4, clampInt16(a.vz * VELOCITY_SCALE));
    o += 6;
  }
  return new Uint8Array(buffer);
}

export interface SnapshotContext {
  roster: Roster;
  mode: GameMode;
  armySize: ArmySize;
  armies: ArmyView[];
  /** Last known positions, so dead units keep a sensible place. */
  previous: MatchView | null;
}

export function decodeSnapshot(bytes: Uint8Array, ctx: SnapshotContext): MatchView {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const time = d.getFloat32(o);
  o += 4;
  const duration = d.getFloat32(o);
  o += 4;
  const phase = PHASES[d.getUint8(o++)] ?? 'playing';
  const winner = d.getInt8(o++);
  const unitCount = d.getUint16(o);
  o += 2;
  const arrowCount = d.getUint16(o);
  o += 2;
  const units: UnitView[] = [];
  for (let i = 0; i < unitCount; i++) {
    const info = ctx.roster[i];
    if (!info) throw new Error('Snapshot does not match the roster');
    const flags = d.getUint8(o++);
    const alive = (flags & FLAG_ALIVE) !== 0;
    if (!alive) {
      const respawnTimer = d.getUint8(o++) / TIMER_SCALE;
      const before = ctx.previous?.units[i];
      const body: Partial<UnitView> = {};
      if (info.kind === 'commander') {
        body.x = d.getInt16(o) / POSITION_SCALE;
        body.y = d.getInt16(o + 2) / POSITION_SCALE;
        body.z = d.getInt16(o + 4) / POSITION_SCALE;
        o += 6;
      }
      units.push({
        ...(before ?? emptyUnit(info)),
        ...body,
        ...info,
        alive: false,
        hp: 0,
        shieldUp: false,
        action: 'none',
        stunTimer: 0,
        respawnTimer,
        mountId: null,
        riderId: null,
      });
      continue;
    }
    const x = d.getInt16(o) / POSITION_SCALE;
    const y = d.getInt16(o + 2) / POSITION_SCALE;
    const z = d.getInt16(o + 4) / POSITION_SCALE;
    o += 6;
    const yaw = (d.getInt16(o) / 32767) * Math.PI;
    o += 2;
    const vx = d.getInt16(o) / VELOCITY_SCALE;
    const vy = d.getInt16(o + 2) / VELOCITY_SCALE;
    const vz = d.getInt16(o + 4) / VELOCITY_SCALE;
    o += 6;
    const hp = d.getUint16(o) / HP_SCALE;
    o += 2;
    const stunTimer = d.getUint8(o++) / TIMER_SCALE;
    const action = ACTIONS[d.getUint8(o++)] ?? 'none';
    const actionTimer = d.getUint8(o++) / TIMER_SCALE;
    const mount = d.getUint16(o);
    const rider = d.getUint16(o + 2);
    o += 4;
    const respawnTimer = d.getUint8(o++) / TIMER_SCALE;
    const group = d.getUint8(o++);
    const weapon = WEAPONS[d.getUint8(o++)] ?? 'sword';
    units.push({
      ...info,
      x,
      y,
      z,
      yaw,
      vx,
      vy,
      vz,
      hp,
      alive,
      onGround: (flags & FLAG_GROUND) !== 0,
      shieldUp: (flags & FLAG_SHIELD) !== 0,
      invulnerable: (flags & FLAG_INVULNERABLE) !== 0,
      drunk: (flags & FLAG_DRUNK) !== 0,
      crouching: (flags & FLAG_CROUCH) !== 0,
      stunTimer,
      action,
      actionTimer,
      mountId: mount === NONE ? null : mount,
      riderId: rider === NONE ? null : rider,
      respawnTimer,
      group,
      weapon,
    });
  }
  const arrows: ArrowView[] = [];
  for (let i = 0; i < arrowCount; i++) {
    const id = d.getUint32(o);
    o += 4;
    const kind = PROJECTILES[d.getUint8(o++)] ?? 'arrow';
    const x = d.getInt16(o) / POSITION_SCALE;
    const y = d.getInt16(o + 2) / POSITION_SCALE;
    const z = d.getInt16(o + 4) / POSITION_SCALE;
    o += 6;
    const vx = d.getInt16(o) / VELOCITY_SCALE;
    const vy = d.getInt16(o + 2) / VELOCITY_SCALE;
    const vz = d.getInt16(o + 4) / VELOCITY_SCALE;
    o += 6;
    arrows.push({ id, kind, x, y, z, vx, vy, vz });
  }
  return {
    time,
    duration,
    phase,
    winnerTeam: winner < 0 ? null : winner,
    mode: ctx.mode,
    armySize: ctx.armySize,
    units,
    arrows,
    armies: ctx.armies,
  };
}

function emptyUnit(info: Roster[number]): UnitView {
  return {
    ...info,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: 0,
    alive: false,
    onGround: true,
    shieldUp: false,
    stunTimer: 0,
    action: 'none',
    actionTimer: 0,
    invulnerable: false,
    mountId: null,
    riderId: null,
    respawnTimer: 0,
    group: 0,
    weapon: 'sword',
    drunk: false,
    crouching: false,
  };
}
