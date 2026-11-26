import { describe, expect, it } from 'vitest';
import { stepMatch } from '../src/match.ts';
import {
  battleSettings,
  canStartBattle,
  decodeSnapshot,
  encodeSnapshot,
  generateRoomCode,
  normalizeRoomCode,
  rosterFor,
  sanitizeInputMessage,
  sanitizeLobbySettings,
  sanitizeName,
  type LobbyMessage,
} from '../src/net.ts';
import { createMatch, defaultSettings } from '../src/setup.ts';
import { matchView } from '../src/view.ts';

function battleView() {
  const settings = defaultSettings({ armySize: 20 });
  const state = createMatch(settings);
  for (let i = 0; i < 20 * 25; i++) stepMatch(state, new Map(), 1 / 20);
  return { settings, view: matchView(state) };
}

describe('snapshot codec', () => {
  it('round-trips a battle within quantization error', () => {
    const { settings, view } = battleView();
    const bytes = encodeSnapshot(view);
    const decoded = decodeSnapshot(bytes, { roster: rosterFor(settings), mode: view.mode, armySize: view.armySize, armies: view.armies, previous: null });
    expect(decoded.units).toHaveLength(view.units.length);
    expect(decoded.arrows).toHaveLength(view.arrows.length);
    expect(decoded.time).toBeCloseTo(view.time, 3);
    view.units.forEach((u, i) => {
      const d = decoded.units[i]!;
      expect(d.alive).toBe(u.alive);
      expect(d.kind).toBe(u.kind);
      expect(d.armyId).toBe(u.armyId);
      if (!u.alive) return;
      expect(d.x).toBeCloseTo(u.x, 1);
      expect(d.z).toBeCloseTo(u.z, 1);
      expect(d.hp).toBeCloseTo(u.hp, 0);
      expect(Math.abs(Math.sin(d.yaw - u.yaw))).toBeLessThan(0.01);
      expect(d.mountId).toBe(u.mountId);
      expect(d.shieldUp).toBe(u.shieldUp);
      expect(d.action).toBe(u.action);
    });
  });

  it('stays small enough for 20 snapshots per second', () => {
    const settings = defaultSettings({
      armySize: 30,
      armies: [0, 1, 2, 3].map((i) => ({ name: `P${i}`, team: i, isBot: false })),
    });
    const bytes = encodeSnapshot(matchView(createMatch(settings)));
    expect(bytes.byteLength).toBeLessThan(5000);
  });
});

describe('lobby rules', () => {
  const lobby = (mode: 'ffa' | 'teams', teams: number[]): LobbyMessage => ({
    code: 'ABCDE',
    hostId: 'a',
    phase: 'lobby',
    mode,
    armySize: 10,
    players: teams.map((team, i) => ({ sessionId: String(i), name: `P${i}`, team, connected: true })),
  });

  it('needs at least two players', () => {
    expect(canStartBattle(lobby('ffa', [0]))).toBe(false);
    expect(canStartBattle(lobby('ffa', [0, 0]))).toBe(true);
  });

  it('needs both teams filled in team mode', () => {
    expect(canStartBattle(lobby('teams', [0, 0, 0]))).toBe(false);
    expect(canStartBattle(lobby('teams', [0, 1, 1]))).toBe(true);
  });

  it('turns a lobby into match settings with one army per player', () => {
    const settings = battleSettings(lobby('teams', [1, 0, 1]), 42);
    expect(settings.armies.map((a) => a.team)).toEqual([1, 0, 1]);
    expect(settings.armies.every((a) => !a.isBot)).toBe(true);
    expect(battleSettings(lobby('ffa', [0, 0]), 1).armies.map((a) => a.team)).toEqual([0, 1]);
  });
});

describe('message validation', () => {
  it('accepts valid inputs and rejects junk', () => {
    expect(sanitizeInputMessage({ seq: 3, input: { moveX: 1, moveZ: 0, faceYaw: 0 } })?.seq).toBe(3);
    expect(sanitizeInputMessage({ seq: -1, input: { moveX: 1, moveZ: 0, faceYaw: 0 } })).toBeNull();
    expect(sanitizeInputMessage({ seq: 1.5, input: {} })).toBeNull();
    expect(sanitizeInputMessage('hello')).toBeNull();
  });

  it('only allows known lobby settings', () => {
    expect(sanitizeLobbySettings({ mode: 'teams', armySize: 20 })).toEqual({ mode: 'teams', armySize: 20 });
    expect(sanitizeLobbySettings({ mode: 'teams', armySize: 25 })).toBeNull();
    expect(sanitizeLobbySettings({ mode: 'chaos', armySize: 20 })).toBeNull();
  });

  it('cleans player names', () => {
    expect(sanitizeName('  <b>Bob</b>  ')).toBe('bBob/b');
    expect(sanitizeName('')).toBe('Commander');
    expect(sanitizeName(42)).toBe('Commander');
    expect(sanitizeName('x'.repeat(40))).toHaveLength(16);
  });

  it('makes readable room codes', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{5}$/);
    expect(code).not.toMatch(/[IO]/);
    expect(normalizeRoomCode(' ab-cde ')).toBe('ABCDE');
  });
});

describe('downed commanders in snapshots', () => {
  it('carry the body position so clients see where they will get up', async () => {
    const { killUnit } = await import('../src/combat.ts');
    const settings = defaultSettings();
    const state = createMatch(settings);
    const commander = state.units[state.armies[0]!.commanderId]!;
    killUnit(state, commander, 1, { x: 5, y: 3, z: 0 });
    for (let i = 0; i < 20; i++) stepMatch(state, new Map(), 1 / 20);
    const view = matchView(state);
    const decoded = decodeSnapshot(encodeSnapshot(view), { roster: rosterFor(settings), mode: view.mode, armySize: view.armySize, armies: view.armies, previous: null });
    const body = decoded.units[commander.id]!;
    expect(body.alive).toBe(false);
    expect(body.x).toBeCloseTo(commander.pos.x, 1);
    expect(body.z).toBeCloseTo(commander.pos.z, 1);
  });
});
